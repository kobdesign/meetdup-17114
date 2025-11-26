import { useState, useEffect } from "react";
import { useLiff } from "@/contexts/LiffContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Share2, 
  Phone, 
  Mail, 
  Building2, 
  Briefcase,
  X,
  Loader2,
  MessageCircle,
  ExternalLink
} from "lucide-react";

interface BusinessCard {
  id: string;
  full_name: string;
  nickname?: string | null;
  position?: string | null;
  company?: string | null;
  tagline?: string | null;
  photo_url?: string | null;
  email?: string | null;
  phone?: string | null;
  website_url?: string | null;
  line_id?: string | null;
  tags?: string[] | null;
}

export default function BusinessCardSearch() {
  const { isLoading, isLoggedIn, user, participant, tenant, login, shareTargetPicker, closeWindow } = useLiff();
  const [searchTerm, setSearchTerm] = useState("");
  const [cards, setCards] = useState<BusinessCard[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCard, setSelectedCard] = useState<BusinessCard | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const { toast } = useToast();

  const brandingColor = tenant?.branding_color || "#1E3A5F";

  useEffect(() => {
    if (isLoggedIn && user?.lineUserId) {
      loadAllCards();
    }
  }, [isLoggedIn, user]);

  const loadAllCards = async () => {
    if (!user?.lineUserId) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/liff/cards/search?line_user_id=${user.lineUserId}`);
      const data = await response.json();
      
      if (data.success) {
        setCards(data.cards);
      }
    } catch (err) {
      console.error("Failed to load cards:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async () => {
    if (!user?.lineUserId) return;
    
    setIsSearching(true);
    setHasSearched(true);
    
    try {
      const url = searchTerm 
        ? `/api/liff/cards/search?line_user_id=${user.lineUserId}&q=${encodeURIComponent(searchTerm)}`
        : `/api/liff/cards/search?line_user_id=${user.lineUserId}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setCards(data.cards);
      } else {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error("Search failed:", err);
      toast({
        title: "Error",
        description: "Failed to search cards",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleShare = async (card: BusinessCard) => {
    if (!user?.lineUserId) return;
    
    setIsSharing(true);
    setSelectedCard(card);
    
    try {
      const response = await fetch(`/api/liff/cards/${card.id}/flex?line_user_id=${user.lineUserId}`);
      const data = await response.json();
      
      if (data.success && data.flexMessage) {
        await shareTargetPicker([data.flexMessage]);
        toast({
          title: "Shared!",
          description: `Business card for ${card.full_name} has been shared.`
        });
      }
    } catch (err: any) {
      if (err.message !== "AbortError") {
        toast({
          title: "Share failed",
          description: err.message || "Could not share the business card",
          variant: "destructive"
        });
      }
    } finally {
      setIsSharing(false);
      setSelectedCard(null);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div 
            className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ backgroundColor: brandingColor }}
          >
            <Search className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Business Card Search</h1>
          <p className="text-muted-foreground mb-6">
            Sign in to search and share business cards from your chapter.
          </p>
          <Button onClick={login} className="w-full" style={{ backgroundColor: brandingColor }}>
            Sign in with LINE
          </Button>
        </div>
      </div>
    );
  }

  // Not linked to any chapter
  if (!participant) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center bg-amber-100">
            <MessageCircle className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Not Registered</h1>
          <p className="text-muted-foreground mb-6">
            You are not registered with any chapter yet. Please register via LINE chat first.
          </p>
          <Button onClick={closeWindow} variant="outline" className="w-full">
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div 
        className="sticky top-0 z-50 px-4 py-3 shadow-sm"
        style={{ backgroundColor: brandingColor }}
      >
        <div className="flex items-center gap-3">
          {tenant?.logo_url && (
            <img 
              src={tenant.logo_url} 
              alt={tenant.name} 
              className="w-8 h-8 rounded-full bg-white/20"
            />
          )}
          <div className="flex-1">
            <h1 className="text-white font-semibold text-lg">Business Cards</h1>
            {tenant && (
              <p className="text-white/70 text-sm">{tenant.name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="sticky top-[60px] z-40 bg-background border-b p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-search"
              placeholder="Search by name, company, tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9 pr-9"
            />
            {searchTerm && (
              <button 
                onClick={() => { setSearchTerm(""); loadAllCards(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <Button 
            data-testid="button-search"
            onClick={handleSearch} 
            disabled={isSearching}
            style={{ backgroundColor: brandingColor }}
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
          </Button>
        </div>
      </div>

      {/* Results */}
      <div className="p-4 space-y-3">
        {isSearching && !hasSearched ? (
          // Initial loading
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : cards.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">
              {hasSearched ? "No business cards found" : "Start searching for business cards"}
            </p>
          </div>
        ) : (
          cards.map((card) => (
            <Card 
              key={card.id} 
              data-testid={`card-business-${card.id}`}
              className="overflow-hidden"
            >
              <CardContent className="p-4">
                <div className="flex gap-3">
                  {/* Avatar */}
                  <Avatar className="w-14 h-14 border-2" style={{ borderColor: brandingColor }}>
                    <AvatarImage src={card.photo_url || undefined} alt={card.full_name} />
                    <AvatarFallback style={{ backgroundColor: brandingColor, color: "white" }}>
                      {getInitials(card.full_name)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{card.full_name}</h3>
                        {card.nickname && (
                          <p className="text-sm text-muted-foreground">"{card.nickname}"</p>
                        )}
                      </div>
                      
                      {/* Share button */}
                      <Button
                        data-testid={`button-share-${card.id}`}
                        size="icon"
                        variant="ghost"
                        onClick={() => handleShare(card)}
                        disabled={isSharing && selectedCard?.id === card.id}
                      >
                        {isSharing && selectedCard?.id === card.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Share2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    {/* Position & Company */}
                    {(card.position || card.company) && (
                      <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                        {card.position && (
                          <>
                            <Briefcase className="w-3 h-3" />
                            <span className="truncate">{card.position}</span>
                          </>
                        )}
                        {card.position && card.company && <span>|</span>}
                        {card.company && (
                          <>
                            <Building2 className="w-3 h-3" />
                            <span className="truncate">{card.company}</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Contact Info */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {card.phone && (
                        <a href={`tel:${card.phone}`} className="inline-flex items-center gap-1 text-xs text-primary">
                          <Phone className="w-3 h-3" />
                          {card.phone}
                        </a>
                      )}
                      {card.line_id && (
                        <a 
                          href={`https://line.me/R/ti/p/~${card.line_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-green-600"
                        >
                          <MessageCircle className="w-3 h-3" />
                          LINE
                        </a>
                      )}
                    </div>

                    {/* Tags */}
                    {card.tags && card.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {card.tags.slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {card.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{card.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
