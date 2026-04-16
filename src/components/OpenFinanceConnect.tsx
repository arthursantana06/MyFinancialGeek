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

  // Account mapping state (step 2)
  const [mappingItemId, setMappingItemId] = useState<string | null>(null);
  const [mappingInstitution, setMappingInstitution] = useState('');
  const [pluggyAccounts, setPluggyAccounts] = useState<PluggyAccount[]>([]);
  const [accountWalletMap, setAccountWalletMap] = useState<Record<string, string>>({});
  const [fetchingAccounts, setFetchingAccounts] = useState(false);
  const [savingMappings, setSavingMappings] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Edit wallet link state
  const [editingConnId, setEditingConnId] = useState<string | null>(null);
  const [editWalletId, setEditWalletId] = useState<string>('');

  // Create wallet inline state
  const [showCreateWallet, setShowCreateWallet] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletType, setNewWalletType] = useState<'checking' | 'credit_card'>('checking');
  const [newWalletColor, setNewWalletColor] = useState(COLORS[0]);
  const [createForAccountId, setCreateForAccountId] = useState<string | null>(null);

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

  /* ── Pluggy widget success: fetch accounts for mapping ── */
  const handleSuccess = useCallback(async (itemData: any) => {
    const itemId = itemData?.item?.id;
    const connectorName = itemData?.item?.connector?.name || 'Instituição';
    setIsConnecting(false);

    if (!itemId) {
      toast.success('Banco conectado!');
      return;
    }

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

  /* ── Step 2: Save account mappings + auto-sync ── */
  const handleSaveMappings = async () => {
    if (!mappingItemId || !user) return;
    setSavingMappings(true);

    try {
      for (const account of pluggyAccounts) {
        const walletId = accountWalletMap[account.id] || null;

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

      toast.success(`${mappingInstitution} configurado! Sincronizando transações...`);
      queryClient.invalidateQueries({ queryKey: ['pluggy_connections'] });

      // Auto-sync: fetch last 30 days of transactions immediately
      setSyncing(true);
      try {
        const result = await syncTransactions(mappingItemId, 30);
        if (result?.inserted > 0) {
          toast.success(`${result.inserted} transações importadas para o Consolidar!`);
        } else {
          toast.info('Nenhuma transação nova encontrada.');
        }
        queryClient.invalidateQueries({ queryKey: ['staged_transactions'] });
      } catch (syncErr: any) {
        console.error('Sync error:', syncErr);
        toast.error('Vínculos salvos, mas erro ao sincronizar: ' + syncErr.message);
      } finally {
        setSyncing(false);
      }

      closeMappingPanel();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar vínculos: ' + err.message);
    } finally {
      setSavingMappings(false);
    }
  };

  /* ── Manual sync for existing connections ── */
  const handleManualSync = async (itemId: string) => {
    setSyncingItemId(itemId);
    try {
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

  /* ── Create wallet inline ── */
  const handleCreateWalletInline = async () => {
    if (!newWalletName.trim()) {
      toast.error('Digite o nome da carteira.');
      return;
    }
    try {
      const result = await addWallet.mutateAsync({
        name: newWalletName.trim(),
        type: newWalletType,
        color: newWalletColor,
        balance: 0,
        include_in_total: true,
      } as any);

      // If we're creating for a specific account mapping, auto-select it
      if (createForAccountId && result?.id) {
        setAccountWalletMap((prev) => ({
          ...prev,
          [createForAccountId]: result.id,
        }));
      }
      // If we're editing a connection, set it
      if (editingConnId && result?.id) {
        setEditWalletId(result.id);
      }

      toast.success(`Carteira "${newWalletName}" criada!`);
      setShowCreateWallet(false);
      setNewWalletName('');
      setNewWalletType('checking');
      setNewWalletColor(COLORS[0]);
      setCreateForAccountId(null);
    } catch (err: any) {
      toast.error(err.message);
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
              <div className="space-y-3">
                {pluggyAccounts.map((account) => {
                  const Icon = accountIcon(account.type);
                  return (
                    <div key={account.id} className="glass-inner rounded-2xl p-4 space-y-3">
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
                            className="w-full appearance-none bg-transparent border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer"
                          >
                            <option value="" className="bg-background text-foreground">
                              Sem vínculo (todas vão para Consolidar)
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
                        <button
                          onClick={() => {
                            setCreateForAccountId(account.id);
                            setShowCreateWallet(true);
                          }}
                          className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors"
                          title="Criar nova carteira"
                        >
                          <Plus size={14} className="text-primary" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleSaveMappings}
                disabled={savingMappings || syncing}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-blue transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingMappings || syncing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                {syncing ? 'Sincronizando transações...' : savingMappings ? 'Salvando...' : 'Salvar e Sincronizar'}
              </button>
            </>
          )}
        </div>

        {/* Create Wallet Drawer */}
        <Drawer open={showCreateWallet} onOpenChange={setShowCreateWallet}>
          <DrawerContent className="bg-background border-t border-glass-border">
            <div className="mx-auto w-full max-w-sm px-4 pb-8">
              <DrawerHeader className="px-0">
                <DrawerTitle className="text-foreground">Nova Carteira</DrawerTitle>
              </DrawerHeader>
              <div className="space-y-4 pt-2">
                <div className="flex gap-1 p-1 rounded-full glass-card">
                  <button
                    onClick={() => setNewWalletType('checking')}
                    className={`flex-1 flex gap-2 justify-center items-center py-2 rounded-full text-xs font-medium transition-all ${newWalletType === 'checking' ? 'pill-active' : 'pill-inactive'}`}
                  >
                    <Banknote size={14} /> Débito/Conta
                  </button>
                  <button
                    onClick={() => setNewWalletType('credit_card')}
                    className={`flex-1 flex gap-2 justify-center items-center py-2 rounded-full text-xs font-medium transition-all ${newWalletType === 'credit_card' ? 'pill-active' : 'pill-inactive'}`}
                  >
                    <CreditCard size={14} /> Cartão
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Nome da Carteira</label>
                  <input
                    type="text"
                    value={newWalletName}
                    onChange={(e) => setNewWalletName(e.target.value)}
                    placeholder="Ex: Nubank, Itaú..."
                    className="w-full glass-inner rounded-xl px-4 py-3 text-base md:text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Cor</label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewWalletColor(c)}
                        className={`w-8 h-8 rounded-full transition-all ${newWalletColor === c ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCreateWalletInline}
                  disabled={addWallet.isPending}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-blue transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {addWallet.isPending ? 'Criando...' : 'Criar Carteira'}
                </button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
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
                const confirmClear = window.confirm("Isso excluirá todas as transações pendentes/ignoradas do Limbo e buscará novamente na origem. Deseja continuar?");
                if (!confirmClear) return;
                
                setSyncing(true);
                try {
                  const { error } = await supabase
                    .from("staged_transactions")
                    .delete()
                    .in("status", ["pending", "rejected"])
                    .eq("user_id", user.id);
                    
                  if (error) throw error;
                  
                  toast.loading("Buscando transações nas integrações...", { id: "reset-sync" });
                  await Promise.all(connections.map(c => syncTransactions(c.pluggy_item_id, 30)));
                  
                  toast.success("Transações recarregadas com sucesso!", { id: "reset-sync" });
                  queryClient.invalidateQueries({ queryKey: ['staged_transactions'] });
                  refetch();
                } catch (err: any) {
                  toast.error("Erro ao sincronizar: " + err.message, { id: "reset-sync" });
                } finally {
                  setSyncing(false);
                }
              }}
              className="w-8 h-8 rounded-xl glass-inner flex items-center justify-center hover:bg-glass-highlight transition-colors disabled:opacity-50"
              title="Limpar pendentes e sincronizar novamente"
            >
              <RefreshCw size={14} className={`text-muted-foreground ${syncing ? 'animate-spin text-primary' : ''}`} />
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
                    const isEditing = editingConnId === conn.id;

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

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                if (isEditing) {
                                  setEditingConnId(null);
                                } else {
                                  setEditingConnId(conn.id);
                                  setEditWalletId(conn.wallet_id || '');
                                }
                              }}
                              className="p-1.5 rounded-lg hover:bg-glass text-muted-foreground hover:text-primary transition-colors"
                              title="Editar vínculo"
                            >
                              <Pencil size={14} />
                            </button>
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

                        {/* Edit wallet inline */}
                        {isEditing && (
                          <div className="flex items-center gap-2 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="relative flex-1">
                              <select
                                value={editWalletId}
                                onChange={(e) => setEditWalletId(e.target.value)}
                                className="w-full appearance-none bg-transparent border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer"
                              >
                                <option value="" className="bg-background text-foreground">Sem vínculo</option>
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
                            <button
                              onClick={() => {
                                setEditingConnId(null);
                                setShowCreateWallet(true);
                              }}
                              className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors"
                              title="Criar nova carteira"
                            >
                              <Plus size={14} className="text-primary" />
                            </button>
                            <button
                              onClick={async () => {
                                await updateConnectionWallet.mutateAsync({
                                  connectionId: conn.id,
                                  walletId: editWalletId || null,
                                  pluggyAccountId: conn.pluggy_account_id,
                                });
                                setEditingConnId(null);
                              }}
                              disabled={updateConnectionWallet.isPending}
                              className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                              {updateConnectionWallet.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Salvar'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Wallet Drawer (from connections list) */}
      <Drawer open={showCreateWallet} onOpenChange={setShowCreateWallet}>
        <DrawerContent className="bg-background border-t border-glass-border">
          <div className="mx-auto w-full max-w-sm px-4 pb-8">
            <DrawerHeader className="px-0">
              <DrawerTitle className="text-foreground">Nova Carteira</DrawerTitle>
            </DrawerHeader>
            <div className="space-y-4 pt-2">
              <div className="flex gap-1 p-1 rounded-full glass-card">
                <button
                  onClick={() => setNewWalletType('checking')}
                  className={`flex-1 flex gap-2 justify-center items-center py-2 rounded-full text-xs font-medium transition-all ${newWalletType === 'checking' ? 'pill-active' : 'pill-inactive'}`}
                >
                  <Banknote size={14} /> Débito/Conta
                </button>
                <button
                  onClick={() => setNewWalletType('credit_card')}
                  className={`flex-1 flex gap-2 justify-center items-center py-2 rounded-full text-xs font-medium transition-all ${newWalletType === 'credit_card' ? 'pill-active' : 'pill-inactive'}`}
                >
                  <CreditCard size={14} /> Cartão
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Nome da Carteira</label>
                <input
                  type="text"
                  value={newWalletName}
                  onChange={(e) => setNewWalletName(e.target.value)}
                  placeholder="Ex: Nubank, Itaú..."
                  className="w-full glass-inner rounded-xl px-4 py-3 text-base md:text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Cor</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewWalletColor(c)}
                      className={`w-8 h-8 rounded-full transition-all ${newWalletColor === c ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreateWalletInline}
                disabled={addWallet.isPending}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-blue transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {addWallet.isPending ? 'Criando...' : 'Criar Carteira'}
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
