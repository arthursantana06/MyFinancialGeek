import { PluggyConnect } from 'react-pluggy-connect';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/useWallets';
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
        .select('*, wallets(name, color, type)')
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
      toast.success('Vínculo atualizado e transações pendentes sincronizadas!');
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
  const { wallets, addWallet } = useWallets();
  const { connections, isLoading, refetch, deleteConnection, updateConnectionWallet } = usePluggyConnections();

  // Pluggy widget state
  const [connectToken, setConnectToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Syncing state
  const [syncing, setSyncing] = useState(false);

  // Sync state for individual connections
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);

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

  /* ── Pluggy widget success: Auto sync accounts and wallets ── */
  const handleSuccess = useCallback(async (itemData: any) => {
    const itemId = itemData?.item?.id;
    const connectorName = itemData?.item?.connector?.name || 'Instituição';
    setIsConnecting(false);

    if (!itemId || !user) {
      toast.success('Conectado sem itemId, verifique os logs.');
      return;
    }

    try {
      toast.loading(`Importando estrutura de contas de ${connectorName}...`, { id: 'auto-sync' });
      
      // 1. Sync accounts to create wallets automatically
      const accRes = await supabase.functions.invoke('pluggy-sync-accounts', {
        body: { itemId, userId: user.id, institutionName: connectorName },
      });
      
      if (accRes.error) throw new Error(accRes.error.message || 'Erro ao criar contas em Wallets');
      
      // 2. Fetch last 30 days of transactions for this item
      toast.loading('As contas foram importadas. Trazendo transações dos últimos 30 dias...', { id: 'auto-sync' });
      const txRes = await syncTransactions(itemId, 30);
      
      let msg = `${connectorName} conectado com sucesso!`;
      if (txRes?.inserted > 0) msg += ` ${txRes.inserted} transações novas pendentes.`;
      
      toast.success(msg, { id: 'auto-sync' });
      
      // 3. Invalidate UI caches so Wallet and Trasanctions tabs reload
      queryClient.invalidateQueries({ queryKey: ['pluggy_connections'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['staged_transactions'] });
      refetch();
    } catch (err: any) {
      console.error(err);
      toast.error('Ocorreu um erro no processo de importação automatizada: ' + err.message, { id: 'auto-sync' });
    }
  }, [user, queryClient, refetch]);

  /* ── Manual sync for existing connections ── */
  const handleManualSync = async (itemId: string) => {
    setSyncingItemId(itemId);
    try {
      // Optamos por re-sincronizar as contas (limites e nomes) toda vez também?
      // O backend pluggy-sync-accounts prevê isso e atualiza as existentnes!
      const conn = connections.find(c => c.pluggy_item_id === itemId);
      if (conn && conn.institution_name) {
         await supabase.functions.invoke('pluggy-sync-accounts', {
           body: { itemId, userId: user?.id, institutionName: conn.institution_name },
         });
         queryClient.invalidateQueries({ queryKey: ['wallets'] });
      }

      const result = await syncTransactions(itemId, 30);
      if (result?.inserted > 0) {
        toast.success(`${result.inserted} transações importadas!`);
        queryClient.invalidateQueries({ queryKey: ['staged_transactions'] });
      } else {
        toast.info('Nenhuma transação nova encontrada.');
      }
    } catch (err: any) {
      toast.error('Erro ao sincronizar: ' + err.message);
    } finally {
      setSyncingItemId(null);
    }
  };

  const accountIcon = (type: string) => {
    if (type === 'CREDIT') return CreditCard;
    return Banknote;
  };

  // Group connections by institution
  const groupedConnections = connections.reduce<Record<string, typeof connections>>((acc, conn) => {
    const key = conn.institution_name || 'Diversos';
    (acc[key] ??= []).push(conn);
    return acc;
  }, {});

  /* ── Pluggy Connect Widget ── */
  if (isConnecting && connectToken) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="w-full h-full max-w-md max-h-[800px] relative">
          <PluggyConnect
            connectToken={connectToken}
            includeSandbox={true}
            onSuccess={handleSuccess}
            onError={(error) => {
              console.error('Connection failed', error);
              toast.error('Conexão falhou: ' + error.message);
              setIsConnecting(false);
            }}
            onClose={() => setIsConnecting(false)}
          />
        </div>
      </div>
    );
  }

  /* ── Main UI: Connected accounts list ── */
  return (
    <div className="space-y-4">
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Landmark size={16} className="text-primary" />
            Open Finance
          </h3>
          <div className="flex items-center gap-2">
            <button
              disabled={syncing}
              onClick={async () => {
                if (!user) return;
                const confirmClear = window.confirm("ATENÇÃO: Isso excluirá PERMANENTEMENTE todas as transações que ainda NÃO foram consolidadas (pendentes e ignoradas) e buscará novamente os dados dos seus bancos. Deseja continuar?");
                if (!confirmClear) return;
                
                setSyncing(true);
                try {
                  toast.loading("Limpando transações pendentes...", { id: "reset-sync" });
                  
                  // 1. Delete all non-consolidated staged transactions
                  const { error } = await supabase
                    .from("staged_transactions")
                    .delete()
                    .in("status", ["pending", "rejected"])
                    .eq("user_id", user.id);
                    
                  if (error) throw error;
                  
                  toast.loading("Buscando novos dados nos bancos vinculados...", { id: "reset-sync" });
                  
                  // 2. Refresh all connections
                  await Promise.all(connections.map(async (c) => {
                    try {
                      await syncTransactions(c.pluggy_item_id, 30);
                    } catch (e) {
                      console.error(`Erro ao sincronizar ${c.institution_name}:`, e);
                    }
                  }));
                  
                  toast.success("Banco de dados renovado com sucesso!", { id: "reset-sync" });
                  queryClient.invalidateQueries({ queryKey: ['staged_transactions'] });
                  queryClient.invalidateQueries({ queryKey: ['wallets'] });
                  refetch();
                } catch (err: any) {
                  toast.error("Erro ao resetar: " + err.message, { id: "reset-sync" });
                } finally {
                  setSyncing(false);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-[10px] font-bold uppercase tracking-wider hover:bg-destructive/20 transition-colors disabled:opacity-50"
              title="Limpar e Recarregar"
            >
              {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Limpar e Recarregar
            </button>
            <div className="w-[1px] h-6 bg-white/10 mx-1" />
            <button
              onClick={handleConnect}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />}
              Conectar
            </button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Conecte seus bancos e vincule cada conta ou cartão a uma conta do sistema.
        </p>

        <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 flex gap-3 items-start">
          <Zap size={14} className="text-primary shrink-0 mt-0.5" />
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            <strong className="text-primary font-semibold">Nota sobre Latência:</strong> Os bancos levam entre 1 a 2 dias (D+1 ou D+2) para disponibilizar suas transações via Open Finance. Se você fez uma compra hoje, ela aparecerá aqui em sua próxima sincronização amanhã ou depois.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 rounded-2xl bg-glass animate-pulse" />
            ))}
          </div>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center py-6 gap-2">
            <Unplug size={28} className="text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground text-center">
              Nenhuma conta conectada ainda.
            </p>
            <button
              onClick={handleConnect}
              disabled={loading}
              className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />}
              Conectar Banco
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedConnections).map(([institution, conns]) => {
              const itemId = conns[0]?.pluggy_item_id;
              const isSyncingThis = syncingItemId === itemId;

              return (
                <div key={institution} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      {institution}
                    </p>
                    <button
                      onClick={() => handleManualSync(itemId)}
                      disabled={isSyncingThis}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                      title="Sincronizar transações"
                    >
                      {isSyncingThis ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Zap size={10} />
                      )}
                      Buscar Novas
                    </button>
                  </div>

                  {conns.map((conn) => {
                    const wallet = conn.wallets as any;
                    const Icon = accountIcon(conn.pluggy_account_type || 'BANK');

                    return (
                      <div
                        key={conn.id}
                        className="glass-inner rounded-2xl p-3 space-y-2"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: wallet ? `${wallet.color}15` : 'hsl(var(--primary) / 0.1)',
                            }}
                          >
                            <Icon
                              size={16}
                              style={{ color: wallet?.color ?? 'hsl(var(--primary))' }}
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {conn.pluggy_account_name || conn.institution_name || 'Conta'}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                              {wallet ? (
                                <>
                                  <CheckCircle2 size={10} className="text-chart-green shrink-0" />
                                  Conta: {wallet.name}
                                </>
                              ) : (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                                  Sem vínculo
                                </>
                              )}
                              {conn.pluggy_account_number &&
                                ` • ****${conn.pluggy_account_number.slice(-4)}`}
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => deleteConnection.mutate({
                                id: conn.id,
                                pluggy_item_id: conn.pluggy_item_id,
                                pluggy_account_id: conn.pluggy_account_id,
                                wallet_id: conn.wallet_id,
                              })}
                              className="p-1.5 rounded-lg hover:bg-glass text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
