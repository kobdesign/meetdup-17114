import { supabaseAdmin } from "../../utils/supabaseClient";

export interface SearchOptions {
  tenantId: string;
  searchTerm: string;
  limit?: number;
  statusFilter?: string[];
  enableCategoryMatching?: boolean;
  tagScanLimit?: number;
  queryTimeoutMs?: number;
  logPrefix?: string;
}

export interface SearchResult {
  participants: ParticipantSearchResult[];
  matchingCategoryCodes: string[];
  count: number;
  timedOutQueries: string[];
}

export interface ParticipantSearchResult {
  participant_id: string;
  tenant_id?: string;
  full_name_th: string | null;
  full_name_en?: string | null;
  nickname_th: string | null;
  nickname_en?: string | null;
  position: string | null;
  company: string | null;
  tagline: string | null;
  photo_url: string | null;
  company_logo_url?: string | null;
  email: string | null;
  phone: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  linkedin_url?: string | null;
  line_id: string | null;
  business_address?: string | null;
  notes?: string | null;
  tags: string[] | null;
  onepage_url: string | null;
  status: string;
}

const DEFAULT_LIMIT = 10;
const DEFAULT_STATUS_FILTER = ["member", "visitor"];
const DEFAULT_TAG_SCAN_LIMIT = 100;
const DEFAULT_QUERY_TIMEOUT_MS = 5000;

const SELECT_FIELDS = `
  participant_id,
  tenant_id,
  full_name_th,
  full_name_en,
  nickname_th,
  nickname_en,
  position,
  company,
  tagline,
  photo_url,
  company_logo_url,
  email,
  phone,
  website_url,
  facebook_url,
  instagram_url,
  linkedin_url,
  line_id,
  business_address,
  notes,
  tags,
  onepage_url,
  status
`;

const SEARCH_FIELDS = [
  'full_name_th',
  'full_name_en',
  'nickname_th',
  'nickname_en',
  'phone',
  'company',
  'tagline',
  'notes'
];

async function queryWithTimeout<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  timeoutMs: number,
  queryName: string,
  logPrefix: string
): Promise<{ data: T | null; error: any; timedOut: boolean }> {
  return new Promise(async (resolve) => {
    const timeout = setTimeout(() => {
      console.log(`${logPrefix} Query "${queryName}" timed out after ${timeoutMs}ms`);
      resolve({ data: null, error: { message: `Query timeout after ${timeoutMs}ms` }, timedOut: true });
    }, timeoutMs);
    
    try {
      const result = await queryFn();
      clearTimeout(timeout);
      resolve({ ...result, timedOut: false });
    } catch (err: any) {
      clearTimeout(timeout);
      console.error(`${logPrefix} Query "${queryName}" threw exception:`, err?.message);
      resolve({ data: null, error: err, timedOut: false });
    }
  });
}

function sanitizeKeywords(searchTerm: string): string[] {
  return searchTerm
    .split(/\s+/)
    .filter(k => k.trim().length > 0)
    .map(k => k
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_')
      .replace(/['";]/g, '')
    )
    .filter(k => k.length > 0);
}

export async function searchParticipants(options: SearchOptions): Promise<SearchResult> {
  const {
    tenantId,
    searchTerm,
    limit = DEFAULT_LIMIT,
    statusFilter = DEFAULT_STATUS_FILTER,
    enableCategoryMatching = false,
    tagScanLimit = DEFAULT_TAG_SCAN_LIMIT,
    queryTimeoutMs = DEFAULT_QUERY_TIMEOUT_MS,
    logPrefix = "[ParticipantSearch]"
  } = options;

  console.log(`${logPrefix} ========== SEARCH START ==========`);
  console.log(`${logPrefix} Tenant ID: ${tenantId}`);
  console.log(`${logPrefix} Search term: "${searchTerm}"`);
  console.log(`${logPrefix} Limit: ${limit}, Status filter: [${statusFilter.join(', ')}]`);
  console.log(`${logPrefix} Category matching: ${enableCategoryMatching}`);

  const result: SearchResult = {
    participants: [],
    matchingCategoryCodes: [],
    count: 0,
    timedOutQueries: []
  };

  const trimmedSearch = searchTerm.trim();
  if (!trimmedSearch) {
    console.log(`${logPrefix} Empty search term`);
    return result;
  }

  const keywords = sanitizeKeywords(trimmedSearch);
  if (keywords.length === 0) {
    console.log(`${logPrefix} No valid keywords after sanitization`);
    return result;
  }

  console.log(`${logPrefix} Multi-keyword search: keywords=[${keywords.join(', ')}]`);

  let matchingCategoryCodes: string[] = [];
  if (enableCategoryMatching) {
    const { data: matchingCategories } = await supabaseAdmin
      .from("business_categories")
      .select("category_code")
      .or(`name_th.ilike.%${trimmedSearch}%,name_en.ilike.%${trimmedSearch}%`);
    
    matchingCategoryCodes = (matchingCategories || []).map(c => c.category_code);
    if (matchingCategoryCodes.length > 0) {
      console.log(`${logPrefix} Found ${matchingCategoryCodes.length} matching categories: [${matchingCategoryCodes.join(', ')}]`);
    }
    result.matchingCategoryCodes = matchingCategoryCodes;
  }

  let participants: ParticipantSearchResult[] = [];
  const participantIds = new Set<string>();

  for (const keyword of keywords) {
    if (participants.length >= limit) break;

    const orConditions = SEARCH_FIELDS.map(field => `${field}.ilike.%${keyword}%`).join(',');
    
    console.log(`${logPrefix} Query for keyword "${keyword}"`);
    const queryStart = Date.now();

    const { data: keywordMatches, error, timedOut } = await queryWithTimeout(
      async () => await supabaseAdmin
        .from("participants")
        .select(SELECT_FIELDS)
        .eq("tenant_id", tenantId)
        .in("status", statusFilter)
        .or(orConditions)
        .limit(limit),
      queryTimeoutMs,
      `field_search_${keyword}`,
      logPrefix
    );

    const queryTime = Date.now() - queryStart;
    console.log(`${logPrefix} Query completed in ${queryTime}ms, found: ${(keywordMatches as any[])?.length || 0} matches`);

    if (timedOut) {
      result.timedOutQueries.push(`field_search_${keyword}`);
      continue;
    }

    if (error) {
      console.error(`${logPrefix} Search error for keyword "${keyword}":`, JSON.stringify(error));
      continue;
    }

    const matches = keywordMatches as ParticipantSearchResult[] | null;
    if (matches && matches.length > 0) {
      console.log(`${logPrefix} Found ${matches.length} matches for "${keyword}"`);
      for (const match of matches) {
        if (participants.length >= limit) break;
        if (!participantIds.has(match.participant_id)) {
          participants.push(match);
          participantIds.add(match.participant_id);
        }
      }
    }

    if (participants.length < limit) {
      console.log(`${logPrefix} Starting tag search for keyword "${keyword}"`);
      const tagQueryStart = Date.now();

      const { data: tagCandidates, timedOut: tagTimedOut } = await queryWithTimeout(
        async () => await supabaseAdmin
          .from("participants")
          .select(SELECT_FIELDS)
          .eq("tenant_id", tenantId)
          .in("status", statusFilter)
          .not("tags", "is", null)
          .limit(tagScanLimit),
        queryTimeoutMs,
        `tag_search_${keyword}`,
        logPrefix
      );

      const tagQueryTime = Date.now() - tagQueryStart;
      const candidates = tagCandidates as ParticipantSearchResult[] | null;
      console.log(`${logPrefix} Tag query completed in ${tagQueryTime}ms, found: ${candidates?.length || 0} candidates`);

      if (tagTimedOut) {
        result.timedOutQueries.push(`tag_search_${keyword}`);
        continue;
      }

      if (candidates && candidates.length > 0) {
        const keywordLower = keyword.toLowerCase();
        
        for (const candidate of candidates) {
          if (participants.length >= limit) break;
          if (participantIds.has(candidate.participant_id)) continue;

          const tags = candidate.tags;
          if (tags && tags.length > 0) {
            const hasMatch = tags.some(tag => 
              tag && tag.toLowerCase().includes(keywordLower)
            );
            if (hasMatch) {
              console.log(`${logPrefix} Tag match found: ${candidate.full_name_th}`);
              participants.push(candidate);
              participantIds.add(candidate.participant_id);
            }
          }
        }
      }
    }
  }

  if (enableCategoryMatching && matchingCategoryCodes.length > 0 && participants.length < limit) {
    for (const categoryCode of matchingCategoryCodes) {
      if (participants.length >= limit) break;

      const { data: categoryMatches } = await supabaseAdmin
        .from("participants")
        .select(SELECT_FIELDS)
        .eq("tenant_id", tenantId)
        .in("status", statusFilter)
        .eq("business_type_code", categoryCode)
        .limit(limit);

      const matches = categoryMatches as ParticipantSearchResult[] | null;
      if (matches && matches.length > 0) {
        console.log(`${logPrefix} Found ${matches.length} matches for category ${categoryCode}`);
        for (const match of matches) {
          if (participants.length >= limit) break;
          if (!participantIds.has(match.participant_id)) {
            participants.push(match);
            participantIds.add(match.participant_id);
          }
        }
      }
    }
  }

  if (participants.length > limit) {
    participants = participants.slice(0, limit);
  }

  result.participants = participants;
  result.count = participants.length;

  const elapsed = Date.now();
  console.log(`${logPrefix} Search complete: ${result.count} results`);

  return result;
}
