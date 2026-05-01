import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
export async function trackEvent(event: string, metadata: any = {}) {
    return await supabase.from('analytics_events').insert([
        {
            event,
            user_id: 'web_user',
            device: 'web',
            metadata,
        },
    ]);
}