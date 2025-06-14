import ConfessionBoard from '../components/ConfessionBoard';
import { supabase } from '../../lib/supabase';

export const dynamic = 'force-dynamic'; // always revalidate on request

interface Confession {
  id: string;
  content: string;
  created_at: string;
  likes?: number;
}

export default async function Home() {
  const { data } = await supabase
    .from('confessions')
    .select('*')
    .order('created_at', { ascending: false });

  return <ConfessionBoard initialConfessions={(data as Confession[]) || []} />;
}

