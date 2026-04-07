import { PluggyConnect } from 'react-pluggy-connect';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function OpenFinanceConnect() {
  const [connectToken, setConnectToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    try {
      setLoading(true);
      // Optional: Get current user ID to track in Pluggy
      const { data: { user } } = await supabase.auth.getUser();
      const clientUserId = user?.id;

      const { data, error } = await supabase.functions.invoke('pluggy-connect-token', {
        body: { clientUserId }
      });

      if (error) {
        throw new Error(error.message || 'Erro ao gerar token do Pluggy');
      }

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

  if (isConnecting && connectToken) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="w-full h-full max-w-md max-h-[800px] relative">
            <PluggyConnect
                connectToken={connectToken}
                includeSandbox={true}
                onSuccess={(itemData) => {
                console.log('Connected!', itemData);
                toast.success("Banco conectado com sucesso!");
                setIsConnecting(false);
                // Here you'd ideally send itemData.item.id to your backend
                }}
                onError={(error) => {
                console.error('Connection failed', error);
                toast.error("Conexão falhou: " + error.message);
                setIsConnecting(false);
                }}
                onClose={() => {
                setIsConnecting(false);
                }}
            />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Integração Open Finance</h3>
      <p className="text-xs text-muted-foreground">
        Conecte suas contas bancárias automaticamente via Pluggy para sincronizar saldos e transações com segurança.
      </p>
      <button
        onClick={handleConnect}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-blue transition-all active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? "Carregando..." : "Conectar Conta Bancária"}
      </button>
    </div>
  );
}
