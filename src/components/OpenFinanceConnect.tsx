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
} from 'lucide-react';

/* ── Types ── */
interface PluggyAccount {
  id: string;
  name: string;
  type: string; // "BANK" | "CREDIT"
  subtype: string;
  number: string;
  balance: number;
  currencyCode: string;
}

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
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pluggy_connections')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pluggy_connections'] });
      toast.success('Conexão removida.');
    },
  });

  return {
    connections: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    deleteConnection,
  };
}

/* ── Component ── */
export default function OpenFinanceConnect() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { wallets } = useWallets();
  const { connections, isLoading, refetch, deleteConnection } = usePluggyConnections();

  // Pluggy widget state
  const [connectToken, setConnectToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Account mapping state (step 2)
  const [mappingItemId, setMappingItemId] = useState<string | null>(null);
  const [mappingInstitution, setMappingInstitution] = useState('');
  const [pluggyAccounts, setPluggyAccounts] = useState<PluggyAccount[]>([]);
  const [accountWalletMap, setAccountWalletMap] = useState<Record<string, string>>({});
  const [fetchingAccounts, setFetchingAccounts] = useState(false);
  const [savingMappings, setSavingMappings] = useState(false);

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

  /* ── Pluggy widget success: fetch accounts for mapping ── */
  const handleSuccess = useCallback(async (itemData: any) => {
    const itemId = itemData?.item?.id;
    const connectorName = itemData?.item?.connector?.name || 'Instituição';
    setIsConnecting(false);

    if (!itemId) {
      toast.success('Banco conectado!');
      return;
    }

    // Move to step 2: fetch accounts
    setMappingItemId(itemId);
    setMappingInstitution(connectorName);
    setFetchingAccounts(true);

    try {
      const { data, error } = await supabase.functions.invoke('pluggy-accounts', {
        body: { itemId },
      });
      if (error) throw new Error(error.message);
      setPluggyAccounts(data?.accounts ?? []);
      setAccountWalletMap({});
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao buscar contas do banco: ' + err.message);
      setMappingItemId(null);
    } finally {
      setFetchingAccounts(false);
    }
  }, []);

  /* ── Step 2: Save account mappings ── */
  const handleSaveMappings = async () => {
    if (!mappingItemId || !user) return;
    setSavingMappings(true);

    try {
      for (const account of pluggyAccounts) {
        const walletId = accountWalletMap[account.id] || null;

        // Check if mapping already exists
        const { data: existing } = await supabase
          .from('pluggy_connections')
          .select('id')
          .eq('pluggy_item_id', mappingItemId)
          .eq('pluggy_account_id', account.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('pluggy_connections')
            .update({
              wallet_id: walletId,
              institution_name: mappingInstitution,
              pluggy_account_name: account.name,
              pluggy_account_type: account.type,
              pluggy_account_number: account.number,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await supabase.from('pluggy_connections').insert({
            user_id: user.id,
            pluggy_item_id: mappingItemId,
            pluggy_account_id: account.id,
            wallet_id: walletId,
            institution_name: mappingInstitution,
            pluggy_account_name: account.name,
            pluggy_account_type: account.type,
            pluggy_account_number: account.number,
          });
        }
      }

      toast.success(`${mappingInstitution} configurado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['pluggy_connections'] });
      closeMappingPanel();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar vínculos: ' + err.message);
    } finally {
      setSavingMappings(false);
    }
  };

  const closeMappingPanel = () => {
    setMappingItemId(null);
    setPluggyAccounts([]);
    setAccountWalletMap({});
    setMappingInstitution('');
  };

  const accountIcon = (type: string) => {
    if (type === 'CREDIT') return CreditCard;
    return Banknote;
  };

  const accountTypeLabel = (type: string) => {
    switch (type) {
      case 'CREDIT': return 'Cartão de Crédito';
      case 'BANK': return 'Conta Bancária';
      default: return type;
    }
  };

  // Group connections by institution
  const groupedConnections = connections.reduce<Record<string, typeof connections>>((acc, conn) => {
    const key = conn.institution_name || 'Sem nome';
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

  /* ── Account Mapping Panel (Step 2) ── */
  if (mappingItemId) {
    return (
      <div className="space-y-4">
        <div className="glass-card p-5 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Landmark size={16} className="text-primary" />
                {mappingInstitution}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Vincule cada conta a uma carteira do sistema
              </p>
            </div>
            <button
              onClick={closeMappingPanel}
              className="w-8 h-8 rounded-xl glass-inner flex items-center justify-center hover:bg-glass-highlight transition-colors"
            >
              <X size={16} className="text-muted-foreground" />
            </button>
          </div>

          {/* Loading */}
          {fetchingAccounts ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <Loader2 size={24} className="animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Buscando contas...</p>
            </div>
          ) : pluggyAccounts.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              Nenhuma conta encontrada nesta instituição.
            </p>
          ) : (
            <>
              {/* Account list */}
              <div className="space-y-3">
                {pluggyAccounts.map((account) => {
                  const Icon = accountIcon(account.type);
                  return (
                    <div key={account.id} className="glass-inner rounded-2xl p-4 space-y-3">
                      {/* Account info */}
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon size={16} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {account.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {accountTypeLabel(account.type)}
                            {account.number ? ` • ****${account.number.slice(-4)}` : ''}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground tabular-nums">
                          R$ {account.balance?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Wallet mapping */}
                      <div className="flex items-center gap-2">
                        <ArrowRight size={12} className="text-muted-foreground/40 shrink-0" />
                        <div className="relative flex-1">
                          <select
                            value={accountWalletMap[account.id] || ''}
                            onChange={(e) =>
                              setAccountWalletMap((prev) => ({
                                ...prev,
                                [account.id]: e.target.value,
                              }))
                            }
                            className="w-full appearance-none bg-transparent border border-glass-border/50 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer"
                          >
                            <option value="" className="bg-background text-foreground">
                              Sem vínculo (não sincronizar)
                            </option>
                            {wallets.map((w) => (
                              <option key={w.id} value={w.id} className="bg-background text-foreground">
                                {w.name}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <ChevronDown size={12} className="text-muted-foreground/50" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Save button */}
              <button
                onClick={handleSaveMappings}
                disabled={savingMappings}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-blue transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingMappings ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                {savingMappings ? 'Salvando...' : 'Salvar Vínculos'}
              </button>
            </>
          )}
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
              onClick={() => refetch()}
              className="w-8 h-8 rounded-xl glass-inner flex items-center justify-center hover:bg-glass-highlight transition-colors"
              title="Atualizar"
            >
              <RefreshCw size={14} className="text-muted-foreground" />
            </button>
            <button
              onClick={handleConnect}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />}
              Conectar
            </button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Conecte seus bancos e vincule cada conta ou cartão a uma carteira do sistema.
        </p>

        {/* Loading */}
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
            {Object.entries(groupedConnections).map(([institution, conns]) => (
              <div key={institution} className="space-y-2">
                {/* Institution header */}
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                  {institution}
                </p>

                {conns.map((conn) => {
                  const wallet = conn.wallets as any;
                  const Icon = accountIcon(conn.pluggy_account_type || 'BANK');
                  return (
                    <div
                      key={conn.id}
                      className="flex items-center gap-3 p-3 rounded-2xl glass-inner group"
                    >
                      {/* Account type icon */}
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

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {conn.pluggy_account_name || conn.institution_name || 'Conta'}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                          {wallet ? (
                            <>
                              <CheckCircle2 size={10} className="text-chart-green shrink-0" />
                              Vinculado a {wallet.name}
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

                      {/* Delete */}
                      <button
                        onClick={() => deleteConnection.mutate(conn.id)}
                        className="p-1.5 rounded-lg hover:bg-glass text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
