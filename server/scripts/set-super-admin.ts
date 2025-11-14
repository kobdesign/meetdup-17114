import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase admin client (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setSuperAdmin(email: string) {
  console.log(`🔧 Setting ${email} as Super Admin\n`);
  
  try {
    // Step 1: Find user by email in auth.users
    console.log('1️⃣  Looking up user in auth.users...');
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      throw new Error(`Auth error: ${authError.message}`);
    }
    
    const user = authData.users.find(u => u.email === email);
    
    if (!user) {
      throw new Error(`User with email ${email} not found in auth.users`);
    }
    
    console.log(`   ✅ Found user: ${user.email}`);
    console.log(`   User ID: ${user.id}\n`);
    
    // Step 2: Check if user already has super_admin role
    console.log('2️⃣  Checking existing roles...');
    const { data: existingRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id);
    
    if (rolesError) {
      throw new Error(`Roles query error: ${rolesError.message}`);
    }
    
    console.log(`   Current roles: ${existingRoles?.length || 0}`);
    existingRoles?.forEach(role => {
      console.log(`     - Role: ${role.role}, Tenant: ${role.tenant_id || 'NULL (super_admin)'}`);
    });
    
    // Check if already super_admin
    const isSuperAdmin = existingRoles?.some(
      role => role.role === 'super_admin' && role.tenant_id === null
    );
    
    if (isSuperAdmin) {
      console.log('\n   ℹ️  User is already a Super Admin!');
      console.log('   No changes needed.\n');
      return;
    }
    
    console.log('');
    
    // Step 3: Create profile if not exists
    console.log('3️⃣  Ensuring profile exists...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError && profileError.code === 'PGRST116') {
      // Profile doesn't exist, create it
      console.log('   Creating profile...');
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin User',
        });
      
      if (insertError) {
        throw new Error(`Profile creation error: ${insertError.message}`);
      }
      console.log('   ✅ Profile created');
    } else if (profileError) {
      throw new Error(`Profile query error: ${profileError.message}`);
    } else {
      console.log(`   ✅ Profile exists: ${profile.full_name}`);
    }
    
    console.log('');
    
    // Step 4: Add super_admin role
    console.log('4️⃣  Adding super_admin role...');
    const { error: insertRoleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: user.id,
        tenant_id: null, // NULL for super_admin
        role: 'super_admin',
      });
    
    if (insertRoleError) {
      // Check if it's duplicate error
      if (insertRoleError.code === '23505') {
        console.log('   ℹ️  Super admin role already exists (duplicate key)');
      } else {
        throw new Error(`Role insert error: ${insertRoleError.message}`);
      }
    } else {
      console.log('   ✅ Super admin role added!');
    }
    
    console.log('');
    
    // Step 5: Verify final state
    console.log('5️⃣  Verifying final state...');
    const { data: finalRoles } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id);
    
    console.log(`   Total roles: ${finalRoles?.length || 0}`);
    finalRoles?.forEach(role => {
      const roleType = role.tenant_id === null ? 'SUPER ADMIN 🌟' : role.role;
      console.log(`     - ${roleType}${role.tenant_id ? ` (Tenant: ${role.tenant_id})` : ''}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ SUCCESS! User is now a Super Admin');
    console.log('='.repeat(80));
    console.log(`\nUser: ${email}`);
    console.log(`ID: ${user.id}`);
    console.log('Role: super_admin (tenant_id = NULL)');
    console.log('\nSuper Admin can:');
    console.log('  ✅ Access all chapters');
    console.log('  ✅ Manage all users');
    console.log('  ✅ Create/delete chapters');
    console.log('  ✅ Override all permissions\n');
    
  } catch (err: any) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

// Get email from command line or use default
const targetEmail = process.argv[2] || 'kobdesign@gmail.com';

setSuperAdmin(targetEmail);
