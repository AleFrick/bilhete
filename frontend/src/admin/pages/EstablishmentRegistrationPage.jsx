import { useState } from 'react';

import { adminApi } from '../api/adminClient';
import AppNotice from '../../components/AppNotice';

export default function EstablishmentRegistrationPage({ onSubmitted }) {
  const [form, setForm] = useState({
    establishmentName: '',
    contactEmail: '',
    contactPhone: '',
    cnpj: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (form.establishmentName.trim().length < 2) {
      setError('Informe o nome do estabelecimento.');
      return;
    }

    setLoading(true);
    try {
      await adminApi.submitRegistration({
        establishmentName: form.establishmentName.trim(),
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim(),
        cnpj: form.cnpj.trim(),
        description: form.description.trim(),
      });
      setSuccess('Pedido de cadastro enviado! Aguarde a aprovacao do administrador.');
      setForm({ establishmentName: '', contactEmail: '', contactPhone: '', cnpj: '', description: '' });
      if (onSubmitted) {
        setTimeout(() => onSubmitted(), 1500);
      }
    } catch (err) {
      setError(err.message || 'Erro ao enviar pedido.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--line, #333)',
    background: 'var(--surface, #1a1a1a)',
    color: 'var(--text, #fff)',
    fontSize: '0.9rem',
  };

  return (
    <section className="panel">
      <h2 style={{ marginTop: 0 }}>Cadastrar estabelecimento</h2>
      <p className="auth-subtitle" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
        Preencha os dados do seu estabelecimento. O administrador ira revisar e aprovar o cadastro.
      </p>

      <AppNotice message={error} type="error" onClose={() => setError('')} />
      <AppNotice message={success} type="success" onClose={() => setSuccess('')} />

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '480px' }}>
        <label>
          Nome do estabelecimento *
          <input
            type="text"
            value={form.establishmentName}
            onChange={(e) => setForm((prev) => ({ ...prev, establishmentName: e.target.value }))}
            required
            minLength={2}
            style={inputStyle}
          />
        </label>

        <label>
          Email de contato *
          <input
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
            required
            style={inputStyle}
          />
        </label>

        <label>
          Telefone de contato
          <input
            type="text"
            value={form.contactPhone}
            onChange={(e) => setForm((prev) => ({ ...prev, contactPhone: e.target.value }))}
            placeholder="(00) 00000-0000"
            style={inputStyle}
          />
        </label>

        <label>
          CNPJ
          <input
            type="text"
            value={form.cnpj}
            onChange={(e) => setForm((prev) => ({ ...prev, cnpj: e.target.value }))}
            placeholder="00.000.000/0000-00"
            style={inputStyle}
          />
        </label>

        <label>
          Descricao / observacoes
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            rows={4}
            placeholder="Conte um pouco sobre o estabelecimento..."
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </label>

        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar pedido de cadastro'}
        </button>
      </form>
    </section>
  );
}
