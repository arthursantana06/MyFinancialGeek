import { PluggyConnect } from 'react-pluggy-connect';
import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/useWallets';
import { useBanks } from '@/hooks/useBanks';
import { toast } from 'sonner';
import {
  Link2,
  Loader2,
  ChevronDown,
  Landmark,
  Plus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Unplug,
  CreditCard,
  Banknote,
  ArrowRight,
  X,
  Pencil,
  Zap,
  ShieldCheck,
  ChevronRight,
  Database,
} from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';

/* ── Types ── */
interface PluggyAccount {
  id: string;
  name: string;
  type: string;
  subtype: string;
  number: string;
  balance: number;
  currencyCode: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

/* ── Hook: usePluggyConnections ── */
function usePluggyConnections() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['pluggy_connections', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pluggy_connections')
        .select('*, wallets(*, banks(*))')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const deleteConnection = useMutation({
    mutationFn: async (conn: { id: string; pluggy_item_id: string; pluggy_account_id: string | null; wallet_id: string | null }) => {
      // Clean up staged transactions for this specific account
      if (conn.pluggy_account_id) {
        await supabase
          .from('staged_transactions')
          .delete()
          .eq('status', 'pending')
          .eq('user_id', user!.id)
          .eq('pluggy_account_id', conn.pluggy_account_id);
      }
      
      const { error } = await supabase
        .from('pluggy_connections')
        .delete()
        .eq('id', conn.id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pluggy_connections'] });
      queryClient.invalidateQueries({ queryKey: ['staged_transactions'] });
      toast.success('Conexão removida e transações pendentes limpas.');
    },
  });

  const updateConnectionWallet = useMutation({
    mutationFn: async ({ connectionId, walletId, pluggyAccountId }: { connectionId: string; walletId: string | null; pluggyAccountId?: string }) => {
      // 1. Update the connection mapping
      const { error } = await supabase
        .from('pluggy_connections')
        .update({ wallet_id: walletId, updated_at: new Date().toISOString() })
        .eq('id', connectionId)
        .eq('user_id', user!.id);
      if (error) throw error;

      // 2. Propagate the mapping change to existing staged transactions
      if (pluggyAccountId) {
        await supabase
          .from('staged_transactions')
          .update({ wallet_id: walletId })
          .eq('user_id', user!.id)
          .eq('pluggy_account_id', pluggyAccountId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pluggy_connections'] });
      queryClient.invalidateQueries({ queryKey: ['staged_transactions'] });
      toast.success('Vínculo atualizado com sucesso!');
    },
  });

  return {
    connections: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    deleteConnection,
    updateConnectionWallet,
  };
}

/* ── Component ── */
export default function OpenFinanceConnect() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { wallets, isLoading: isWalletsLoading } = useWallets();
  const { banks, isLoading: isBanksLoading } = useBanks();
  const { connections, isLoading: isConnectionsLoading, refetch, deleteConnection, updateConnectionWallet } = usePluggyConnections();

  const isLoading = isConnectionsLoading || isWalletsLoading || isBanksLoading;

  // Pluggy widget state
  const [connectToken, setConnectToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [loading, setLoading] = useState(false);

  // Syncing state
  const [syncing, setSyncing] = useState(false);
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);

  // Linking Drawer State
  const [linkingConn, setLinkingConn] = useState<any>(null);

  /* ── Step 1: Open Pluggy widget ── */
  const handleConnect = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('pluggy-connect-token', {
        body: { clientUserId: user?.id },
      });
      if (error) throw new Error(error.message || 'Erro ao gerar token');
      if (data?.accessToken) {
        setConnectToken(data.accessToken);
        setIsConnecting(true);
      } else {
        throw new Error('Token não retornado');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Falha ao iniciar Open Finance');
    } finally {
      setLoading(false);
    }
  };

  /* ── Sync transactions for a given itemId ── */
  const syncTransactions = async (itemId: string, fromDays: number = 30) => {
    if (!user) return;
    
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - fromDays);
    const fromDateStr = fromDate.toISOString().split('T')[0];

    const { data, error } = await supabase.functions.invoke('pluggy-sync-transactions', {
      body: { itemId, userId: user.id, fromDate: fromDateStr },
    });
    if (error) throw new Error(error.message);
    return data;
  };

  /* ── Pluggy widget success ── */
  const handleSuccess = useCallback(async (itemData: any) => {
    const itemId = itemData?.item?.id;
    const connectorName = itemData?.item?.connector?.name || 'Instituição';
    setIsConnecting(false);

    if (!itemId || !user) return;

    try {
      toast.loading(`Mapeando contas de ${connectorName}...`, { id: 'auto-sync' });
      
      const accRes = await supabase.functions.invoke('pluggy-sync-accounts', {
        body: { itemId, userId: user.id, institutionName: connectorName },
      });
      
      if (accRes.error) throw new Error(accRes.error.message);
      
      toast.loading('Iniciando primeira carga de transações (30 dias)...', { id: 'auto-sync' });
      const txRes = await syncTransactions(itemId, 30);
      
      toast.success(`${connectorName} conectado!`, { id: 'auto-sync' });
      
      queryClient.invalidateQueries({ queryKey: ['pluggy_connections'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['staged_transactions'] });
      refetch();
    } catch (err: any) {
      toast.error('Erro na carga inicial: ' + err.message, { id: 'auto-sync' });
    }
  }, [user, queryClient, refetch]);

  /* ── Manual sync ── */
  const handleManualSync = async (itemId: string) => {
    setSyncingItemId(itemId);
    try {
      const conn = connections.find(c => c.pluggy_item_id === itemId);
      if (conn && conn.institution_name) {
         await supabase.functions.invoke('pluggy-sync-accounts', {
           body: { itemId, userId: user?.id, institutionName: conn.institution_name },
         });
      }

      const result = await syncTransactions(itemId, 30);
      if (result?.inserted > 0) {
        toast.success(`${result.inserted} novas transações!`);
        queryClient.invalidateQueries({ queryKey: ['staged_transactions'] });
      } else {
        toast.info('Banco sem novas transações pendentes.');
      }
    } catch (err: any) {
      toast.error('Erro ao buscar novos dados: ' + err.message);
    } finally {
      setSyncingItemId(null);
    }
  };

  /* ── Reset Utility ── */
  const handleResetAndReload = async () => {
    if (!user || !connections.length) return;
    
    const confirm = window.confirm("ATENÇÃO: Este procedimento excluirá todas as transações NÃO CONSOLIDADAS (pendentes) e recarregará tudo respeitando os novos vínculos. Deseja prosseguir?");
    if (!confirm) return;

    setSyncing(true);
    try {
      toast.loading("Limpando transações pendentes...", { id: "reset-sync" });
      
      const { error } = await supabase
        .from("staged_transactions")
        .delete()
        .in("status", ["pending", "rejected"])
        .eq("user_id", user.id);
        
      if (error) throw error;
      
      toast.loading("Recarregando dados dos bancos...", { id: "reset-sync" });
      
      await Promise.all(connections.map(async (c) => {
        try {
          await syncTransactions(c.pluggy_item_id, 30);
        } catch (e) {
          console.error(`Falha ao recarregar ${c.institution_name}`, e);
        }
      }));
      
      toast.success("Banco de dados renovado com sucesso!", { id: "reset-sync" });
      queryClient.invalidateQueries({ queryKey: ['staged_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      refetch();
    } catch (err: any) {
      toast.error("Falha no reset: " + err.message, { id: "reset-sync" });
    } finally {
      setSyncing(false);
    }
  };

  const accountIcon = (type: string) => {
    if (type === 'CREDIT') return CreditCard;
    return Banknote;
  };

  // Grouped connections by Bank in our system
  const groupedByBank = useMemo(() => {
    const groups: Record<string, { bank: any, conns: typeof connections }> = {};
    
    connections.forEach(conn => {
      const wallet = conn.wallets as any;
      const bankId = wallet?.bank_id || 'unlinked';
      const bank = bankId === 'unlinked' ? null : banks.find(b => b.id === bankId);
      const bankName = bank?.name || conn.institution_name || 'Diversos';
      const key = bankId === 'unlinked' ? `unlinked-${bankName}` : bankId;

      if (!groups[key]) {
        groups[key] = { bank, conns: [] };
      }
      groups[key].conns.push(conn);
    });

    return Object.values(groups);
  }, [connections, banks]);

  if (isConnecting && connectToken) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl">
        <div className="w-full h-full max-w-md relative animate-in fade-in zoom-in-95 duration-500">
           <div className="absolute top-4 right-4 z-50">
             <button onClick={() => setIsConnecting(false)} className="w-10 h-10 rounded-full glass-card flex items-center justify-center text-white">
                <X size={20} />
             </button>
           </div>
          <PluggyConnect
            connectToken={connectToken}
            includeSandbox={true}
            onSuccess={handleSuccess}
            onError={(error) => {
              toast.error('Conexão falhou: ' + error.message);
              setIsConnecting(false);
            }}
            onClose={() => setIsConnecting(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header Controls */}
      <div className="glass-card p-6 space-y-5 border-[0.5px] border-white/5 shadow-2xl relative overflow-hidden rounded-[2rem]">
        <div className="absolute top-0 right-0 p-6 opacity-[0.02] pointer-events-none rotate-12">
           <Database size={120} strokeWidth={1} />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/10">
                <Landmark size={20} className="text-primary" />
             </div>
             <div>
               <h3 className="text-lg font-bold text-white tracking-tight uppercase">
                 Open Finance
               </h3>
               <p className="text-[9px] font-bold text-primary uppercase tracking-[0.2em] opacity-40">
                  Sincronização Inteligente
               </p>
             </div>
          </div>
          
          <div className="flex items-center gap-2.5">
             <button
               onClick={handleResetAndReload}
               disabled={syncing || connections.length === 0}
               className={`w-11 h-11 rounded-xl glass-inner flex items-center justify-center transition-all active:scale-95 border-[0.5px] border-white/5 ${syncing ? 'text-primary' : 'text-primary/40 hover:text-primary hover:bg-primary/5'}`}
               title="Limpar e Recarregar Estrutura"
             >
               {syncing ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={18} strokeWidth={2.5} />}
             </button>

             <button
               onClick={handleConnect}
               disabled={loading}
               className="h-11 px-6 rounded-xl bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all active:scale-[0.97] flex items-center gap-2.5"
             >
               {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={4} />}
               Conectar
             </button>
          </div>
        </div>

        <div className="glass-inner p-4 rounded-2xl flex gap-4 items-start relative z-10 border border-white/5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
             <Zap size={14} className="text-primary" fill="currentColor" />
          </div>
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest leading-none">Status de Sincronia</p>
            <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-tight opacity-40 leading-relaxed">
              Delay oficial de 24h a 48h dependendo do banco.
            </p>
          </div>
        </div>
      </div>

      {/* Connection List Hierarchy */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="space-y-4 animate-in fade-in duration-500">
            {[1, 2].map(i => (
              <div key={i} className="h-40 rounded-3xl glass-card animate-pulse" />
            ))}
          </div>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-4 text-center glass-card border-dashed border-2 border-white/5 opacity-60">
            <Unplug size={40} strokeWidth={1} className="text-white/20" />
            <div className="space-y-1">
               <p className="text-sm font-black text-white uppercase tracking-widest">Nenhuma Conexão</p>
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Conecte seu primeiro banco para começar.</p>
            </div>
          </div>
        ) : (
          groupedByBank.map((group, gIdx) => (
            <div key={gIdx} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${gIdx * 100}ms` }}>
              <div className="flex items-center gap-3 px-2">
                 <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: group.bank?.color || '#3b82f6', boxShadow: `0 0 10px ${group.bank?.color || '#3b82f6'}` }} />
                 <h4 className="text-[11px] font-black text-white/50 uppercase tracking-[0.3em]">
                   {group.bank?.name || group.conns[0].institution_name || 'Desconhecido'}
                 </h4>
                 <div className="flex-1 h-px bg-white/5" />
                 <button 
                   onClick={() => handleManualSync(group.conns[0].pluggy_item_id)}
                   disabled={syncingItemId === group.conns[0].pluggy_item_id}
                   className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                 >
                   {syncingItemId === group.conns[0].pluggy_item_id ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} strokeWidth={3} />}
                   Sincronizar
                 </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {group.conns.map(conn => {
                  const wallet = conn.wallets as any;
                  const Icon = accountIcon(conn.pluggy_account_type || 'BANK');
                  const bgColor = wallet?.color || '#3b82f6';

                  return (
                    <div key={conn.id} className="glass-card hover:bg-white/[0.03] transition-all p-5 rounded-[1.75rem] border-[0.5px] border-white/5 shadow-xl flex items-center gap-5 group relative overflow-hidden">
                       <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
                       
                       <div className="w-11 h-11 rounded-xl glass-inner flex items-center justify-center shrink-0 shadow-inner relative overflow-hidden group-hover:scale-105 transition-transform">
                         <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundColor: bgColor }} />
                         <Icon size={18} className="text-white opacity-40 group-hover:opacity-100 transition-all" style={{ color: wallet?.color }} />
                       </div>

                       <div className="flex-1 min-w-0 relative z-10">
                         <p className="text-sm font-bold text-white truncate tracking-tight">{conn.pluggy_account_name || 'Conta Digital'}</p>
                         <div className="flex items-center gap-2.5 mt-1">
                            {wallet ? (
                              <div className="flex items-center gap-1 py-0.5 px-2 rounded-full bg-emerald-500/5 border border-emerald-500/10 backdrop-blur-md">
                                <ShieldCheck size={9} className="text-emerald-500" />
                                <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest">{wallet.name}</span>
                              </div>
                            ) : (
                               <div className="flex items-center gap-1 py-0.5 px-2 rounded-full bg-orange-500/5 border border-orange-500/10 backdrop-blur-md">
                                <XCircle size={9} className="text-orange-500" />
                                <span className="text-[8px] font-bold text-orange-500 uppercase tracking-widest">Sem Vínculo</span>
                              </div>
                            )}
                            {conn.pluggy_account_number && (
                               <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest tabular-nums">#{conn.pluggy_account_number.slice(-4)}</span>
                            )}
                         </div>
                       </div>

                       <div className="flex items-center gap-2 relative z-10">
                          <button
                            onClick={() => setLinkingConn(conn)}
                            className="w-10 h-10 rounded-lg glass-inner flex items-center justify-center text-white/40 hover:text-primary transition-all hover:scale-110"
                            title="Vincular Conta"
                          >
                            <Link2 size={16} strokeWidth={2.5} />
                          </button>
                          <button
                            onClick={() => {
                              if(window.confirm("Remover esta conexão e limpar dados pendentes?")) {
                                deleteConnection.mutate({
                                  id: conn.id,
                                  pluggy_item_id: conn.pluggy_item_id,
                                  pluggy_account_id: conn.pluggy_account_id,
                                  wallet_id: conn.wallet_id,
                                });
                              }
                            }}
                            className="w-10 h-10 rounded-lg glass-inner flex items-center justify-center text-white/20 hover:text-destructive transition-all hover:scale-110"
                          >
                            <Trash2 size={16} />
                          </button>
                       </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Linking Drawer */}
      <Drawer open={!!linkingConn} onOpenChange={(v) => !v && setLinkingConn(null)}>
        <DrawerContent className="bg-background border-t border-white/10">
           <div className="mx-auto w-full max-w-sm px-6 pb-12">
              <div className="w-12 h-1.5 rounded-full bg-white/10 mx-auto mt-4 mb-8" />
              <DrawerHeader className="px-0 pb-8 text-center">
                 <DrawerTitle className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-4">Vincular Conta</DrawerTitle>
                 <p className="text-xl font-black text-white tracking-tighter leading-tight italic">
                   {linkingConn?.pluggy_account_name || 'Selecione o destino desta conta'}
                 </p>
              </DrawerHeader>

              <div className="space-y-4">
                 <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] px-2 mb-2">Contas Disponíveis no Sistema</p>
                 <div className="grid grid-cols-1 gap-2 max-h-[40vh] overflow-y-auto px-1 hide-scrollbar">
                    {wallets.map(w => (
                      <button
                        key={w.id}
                        onClick={() => {
                           updateConnectionWallet.mutate({
                             connectionId: linkingConn.id,
                             walletId: w.id,
                             pluggyAccountId: linkingConn.pluggy_account_id
                           });
                           setLinkingConn(null);
                        }}
                        className={`flex items-center gap-4 p-4 rounded-2xl glass-inner border border-transparent transition-all hover:border-primary/40 text-left relative overflow-hidden group
                          ${linkingConn?.wallet_id === w.id ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(59,130,246,0.2)]' : ''}`}
                      >
                         <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg relative overflow-hidden" 
                           style={{ backgroundColor: `${w.color}15` }}>
                            <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundColor: w.color }} />
                            <Landmark size={18} style={{ color: w.color }} />
                         </div>
                         <div className="flex-1">
                            <p className="text-sm font-black text-white group-hover:text-primary transition-colors">{w.name}</p>
                            <div className="flex items-center gap-2">
                               <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60 tracking-widest">{w.banks?.name || 'Banco Local'}</p>
                               {linkingConn?.wallet_id === w.id && <span className="text-[9px] font-black text-primary uppercase italic">(VINCULADO)</span>}
                            </div>
                         </div>
                         <ChevronRight size={16} className="text-white/20 group-hover:text-primary transition-all group-hover:translate-x-1" />
                      </button>
                    ))}

                    <button
                      onClick={() => {
                         updateConnectionWallet.mutate({
                           connectionId: linkingConn.id,
                           walletId: null,
                           pluggyAccountId: linkingConn.pluggy_account_id
                         });
                         setLinkingConn(null);
                      }}
                      className="flex items-center gap-4 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-all border border-transparent hover:border-destructive/20"
                    >
                       <XCircle size={16} />
                       Remover Vínculo dEsta Conta
                    </button>
                 </div>
              </div>
           </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function XCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}
