import { useEffect, useState } from 'react';

import { adminApi } from '../api/adminClient';
import AppNotice from '../../components/AppNotice';

export default function AdminPaymentConfigPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('success');

  const [environment, setEnvironment] = useState('sandbox');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [webhookToken, setWebhookToken] = useState('');
  const [enabled, setEnabled] = useState(false);

  const showFeedback = (message, type = 'success') => {
    setFeedback(message);
    setFeedbackType(type);
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getPaymentSettings();
      setSettings(data);
      setEnvironment(data.environment || 'sandbox');
      setApiKey('');
      setApiUrl(data.apiUrl || '');
      setWebhookToken('');
      setEnabled(data.enabled || false);
    } catch (error) {
      showFeedback(error.message || 'Erro ao carregar configuracoes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setFeedback('');
    try {
      const payload = {
        environment,
        apiUrl: apiUrl.trim() || undefined,
        enabled,
      };
      if (apiKey.trim()) {
        payload.apiKey = apiKey.trim();
      }
      if (webhookToken.trim()) {
        payload.webhookToken = webhookToken.trim();
      }

      const updated = await adminApi.updatePaymentSettings(payload);
      setSettings(updated);
      setApiKey('');
      setWebhookToken('');
      showFeedback('Configuracoes salvas com sucesso.');
    } catch (error) {
      showFeedback(error.message || 'Erro ao salvar configuracoes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page-stack">
      <AppNotice
        message={feedback}
        type={feedbackType}
        floating
        autoHideMs={4000}
        onClose={() => setFeedback('')}
      />

      <section className="panel">
        <h2>Configuracoes de Pagamento</h2>
        <p className="auth-subtitle">
          Configure a integracao com o Asaas para processar pagamentos premium.
        </p>

        {loading ? (
          <p>Carregando configuracoes...</p>
        ) : null}

        {!loading && settings ? (
          <div className="admin-form" style={{ maxWidth: '640px' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: enabled ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
              border: `1px solid ${enabled ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'}`,
              marginBottom: '20px',
            }}>
              <strong>Status:</strong>{' '}
              {enabled ? (
                <span style={{ color: '#22c55e' }}>Ativo — pagamentos processados via Asaas</span>
              ) : (
                <span style={{ color: '#eab308' }}>Inativo — checkout usa provedor mock</span>
              )}
            </div>

            <label>
              Ambiente
              <select value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                <option value="sandbox">Sandbox (testes)</option>
                <option value="production">Producao</option>
              </select>
              <small className="auth-subtitle">
                Use sandbox para testes. Mude para producao apenas quando estiver pronto.
              </small>
            </label>

            <label>
              API Key{settings.apiKeySet ? ` (ja configurada: ${settings.apiKey})` : ''}
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={settings.apiKeySet ? 'Deixe vazio para manter a atual' : '$aac...'}
              />
              <small className="auth-subtitle">
                Chave de acesso do Asaas. Encontre em Configuracoes {'> '} API no painel Asaas.
              </small>
            </label>

            <label>
              URL da API (opcional)
              <input
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://api.asaas.com (padrao)"
              />
              <small className="auth-subtitle">
                Deixe vazio para usar a URL padrao do Asaas.
              </small>
            </label>

            <label>
              Webhook Token{settings.webhookTokenSet ? ' (ja configurado: ***)' : ''}
              <input
                type="password"
                value={webhookToken}
                onChange={(e) => setWebhookToken(e.target.value)}
                placeholder={settings.webhookTokenSet ? 'Deixe vazio para manter o atual' : 'Token do webhook'}
              />
              <small className="auth-subtitle">
                Token para validar notificacoes de pagamento. Configure o webhook no Asaas apontando para:{' '}
                <code>{typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/asaas` : '/api/webhooks/asaas'}</code>
              </small>
            </label>

            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Habilitar pagamentos via Asaas
            </label>

            {settings.updatedAt ? (
              <p className="auth-subtitle" style={{ fontSize: '0.8rem' }}>
                Ultima atualizacao: {new Date(settings.updatedAt).toLocaleString('pt-BR')}
              </p>
            ) : null}

            <div className="inline-row" style={{ marginTop: '16px' }}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Salvando...' : 'Salvar configuracoes'}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={loadSettings}
                disabled={saving || loading}
              >
                Recarregar
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h3>Como configurar</h3>
        <ol style={{ paddingLeft: '20px', lineHeight: 1.8, fontSize: '0.9rem' }}>
          <li>Crie uma conta no <a href="https://asaas.com" target="_blank" rel="noopener noreferrer">Asaas</a></li>
          <li>Acesse Configuracoes &gt; API e gere uma chave de acesso</li>
          <li>Selecione o ambiente (sandbox para testes, producao para real)</li>
          <li>Cole a API Key no campo acima e salve</li>
          <li>Marque &quot;Habilitar pagamentos via Asaas&quot; para ativar</li>
          <li>No painel do Asaas, configure o webhook para a URL exibida acima</li>
          <li>Defina um token de webhook e cole no campo correspondente</li>
        </ol>
      </section>
    </div>
  );
}
