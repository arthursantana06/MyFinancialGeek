import { useState, useEffect } from "react";
import { ArrowLeft, Camera, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Language } from "@/i18n/translations";

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, photo_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name || "");
          setPhotoUrl(data.photo_url);
        }
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", user.id);
      if (error) throw error;
      toast.success(t("profile.saved"));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const initials = (displayName || user?.email || "U")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 py-4">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl glass-card flex items-center justify-center"
          >
            <ArrowLeft size={18} className="text-muted-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">{t("profile.title")}</h1>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-2 border-glass-highlight bg-glass flex items-center justify-center overflow-hidden">
              {photoUrl ? (
                <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-foreground">{initials}</span>
              )}
            </div>
            <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center glow-blue">
              <Camera size={14} className="text-primary-foreground" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>

        {/* Form */}
        <div className="glass-card p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">{t("profile.displayName")}</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full glass-inner rounded-xl px-4 py-3 text-sm text-foreground bg-transparent focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">{t("profile.email")}</label>
            <div className="w-full glass-inner rounded-xl px-4 py-3 text-sm text-muted-foreground">
              {user?.email}
            </div>
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Globe size={12} />
              {t("profile.language")}
            </label>
            <div className="flex gap-2">
              {([["pt-BR", "Português"], ["en", "English"]] as [Language, string][]).map(([code, label]) => (
                <button
                  key={code}
                  onClick={() => setLanguage(code)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${language === code ? "pill-active" : "glass-inner text-muted-foreground"
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-blue transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? t("profile.saving") : t("profile.save")}
          </button>
        </div>

        {/* Settings */}
        <button
          onClick={() => navigate("/settings")}
          className="w-full py-3 rounded-xl glass-card flex items-center justify-between px-4 text-foreground font-semibold text-sm transition-all active:scale-[0.98]"
        >
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t("settings.title")}</span>
          </div>
        </button>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full py-3 rounded-xl glass-card text-destructive font-semibold text-sm transition-all active:scale-[0.98]"
        >
          {t("profile.signOut")}
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
