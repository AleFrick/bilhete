import { useEffect, useRef, useState } from 'react';

import ChangePasswordForm from '../components/ChangePasswordForm';
import PremiumOrdersHistory from '../components/PremiumOrdersHistory';
import TermsModal from '../components/TermsModal';
import { api } from '../api/client';

const INTENTIONS = [
  { value: 'conversar', label: 'Conversar' },
  { value: 'flertar', label: 'Flertar' },
  { value: 'amizade', label: 'Amizade' },
  { value: 'networking', label: 'Networking' },
  { value: 'observando', label: 'Observando' },
];

function parsePhotoUrls(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  return [];
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Falha ao ler imagem.'));
    reader.readAsDataURL(file);
  });
}

function resizeDataUrlImage(dataUrl, maxSide = 1080, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const longestSide = Math.max(image.width, image.height);
      const ratio = longestSide > maxSide ? maxSide / longestSide : 1;
      const width = Math.max(1, Math.round(image.width * ratio));
      const height = Math.max(1, Math.round(image.height * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Falha ao processar imagem.'));
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    image.onerror = () => reject(new Error('Falha ao carregar imagem.'));
    image.src = dataUrl;
  });
}

export default function ProfilePage({ me, onSave, apiClient, premiumActive, onAccountDeleted }) {
  const [profileTab, setProfileTab] = useState('profile'); // 'profile' | 'premium' | 'security'
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const fileInputRef = useRef(null);
  const [newEmail, setNewEmail] = useState('');
  const [emailChangeMsg, setEmailChangeMsg] = useState('');
  const [emailChangeError, setEmailChangeError] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [form, setForm] = useState({
    name: me?.name || '',
    age: me?.age || '',
    photoUrls: parsePhotoUrls(me?.photoUrls),
    statusSocial: me?.statusSocial || 'observando',
  });
  const [mainPhotoIndex, setMainPhotoIndex] = useState(0);
  const [previewState, setPreviewState] = useState({
    open: false,
    url: '',
    alt: 'Preview da foto',
    index: 0,
  });

  useEffect(() => {
    setForm({
      name: me?.name || '',
      age: me?.age || '',
      photoUrls: parsePhotoUrls(me?.photoUrls),
      statusSocial: me?.statusSocial || 'observando',
    });
    setMainPhotoIndex(0);
  }, [me]);

  const handlePickPhoto = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoSelected = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const rawDataUrl = await fileToDataUrl(file);
      if (!rawDataUrl) {
        return;
      }

      const optimizedDataUrl = await resizeDataUrlImage(rawDataUrl);

      setForm((prev) => ({
        ...prev,
        photoUrls: [...prev.photoUrls, optimizedDataUrl].slice(0, 5),
      }));
    } catch (error) {
      // Keep silent; user can try selecting the image again.
    } finally {
      event.target.value = '';
    }
  };

  const handleRemovePhoto = (indexToRemove) => {
    if (indexToRemove < 0 || indexToRemove >= form.photoUrls.length) {
      return;
    }

    setForm((prev) => {
      const nextUrls = prev.photoUrls.filter((_, index) => index !== indexToRemove);
      return {
        ...prev,
        photoUrls: nextUrls,
      };
    });

    if (mainPhotoIndex >= form.photoUrls.length - 1) {
      setMainPhotoIndex(Math.max(0, form.photoUrls.length - 2));
    } else if (indexToRemove <= mainPhotoIndex) {
      setMainPhotoIndex(Math.max(0, mainPhotoIndex - 1));
    }
  };

  const handleMovePhotoLeft = (index) => {
    if (index <= 0) {
      return;
    }

    setForm((prev) => {
      const newUrls = [...prev.photoUrls];
      [newUrls[index], newUrls[index - 1]] = [newUrls[index - 1], newUrls[index]];
      return {
        ...prev,
        photoUrls: newUrls,
      };
    });
  };

  const handleMovePhotoRight = (index) => {
    if (index >= form.photoUrls.length - 1) {
      return;
    }

    setForm((prev) => {
      const newUrls = [...prev.photoUrls];
      [newUrls[index], newUrls[index + 1]] = [newUrls[index + 1], newUrls[index]];
      return {
        ...prev,
        photoUrls: newUrls,
      };
    });
  };

  const openImagePreview = (index) => {
    if (!form.photoUrls[index]) {
      return;
    }

    setPreviewState({
      open: true,
      url: form.photoUrls[index],
      alt: `Foto ${index + 1} do perfil`,
      index,
    });
  };

  const closeImagePreview = () => {
    setPreviewState({
      open: false,
      url: '',
      alt: 'Preview da foto',
      index: 0,
    });
  };

  const goToPreviousPreviewImage = () => {
    if (form.photoUrls.length < 2) {
      return;
    }

    setPreviewState((prev) => {
      const nextIndex = (prev.index - 1 + form.photoUrls.length) % form.photoUrls.length;
      return {
        ...prev,
        url: form.photoUrls[nextIndex],
        alt: `Foto ${nextIndex + 1} do perfil`,
        index: nextIndex,
      };
    });
  };

  const goToNextPreviewImage = () => {
    if (form.photoUrls.length < 2) {
      return;
    }

    setPreviewState((prev) => {
      const nextIndex = (prev.index + 1) % form.photoUrls.length;
      return {
        ...prev,
        url: form.photoUrls[nextIndex],
        alt: `Foto ${nextIndex + 1} do perfil`,
        index: nextIndex,
      };
    });
  };

  const handleEmailChange = async (event) => {
    event.preventDefault();
    setEmailChangeMsg('');
    setEmailChangeError('');

    if (!newEmail.trim()) {
      setEmailChangeError('Informe o novo e-mail.');
      return;
    }

    try {
      const data = await apiClient.changeEmail(newEmail.trim());
      setEmailChangeMsg(data.message || 'Enviamos um e-mail de confirmacao para o novo endereco.');
      setNewEmail('');
    } catch (error) {
      setEmailChangeError(error.message || 'Erro ao solicitar troca de e-mail.');
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');

    if (!deletePassword.trim()) {
      setDeleteError('Digite sua senha para confirmar.');
      return;
    }

    try {
      await apiClient.deleteAccount(deletePassword);
      if (onAccountDeleted) {
        onAccountDeleted();
      }
    } catch (error) {
      setDeleteError(error.message || 'Erro ao excluir conta.');
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const parsedAge = Number.parseInt(String(form.age), 10);
    const payload = {
      name: form.name.trim(),
      statusSocial: form.statusSocial,
      photoUrls: form.photoUrls.filter((item) => typeof item === 'string' && item.trim().length > 0),
    };

    if (Number.isFinite(parsedAge)) {
      payload.age = parsedAge;
    }

    onSave({
      ...payload,
    });
  };

  const tabStyle = (key) => ({
    padding: '8px 20px',
    background: 'none',
    border: 'none',
    borderBottom: profileTab === key ? '2px solid var(--accent, #ff2d55)' : '2px solid transparent',
    color: profileTab === key ? 'var(--text)' : 'var(--muted)',
    cursor: 'pointer',
    fontWeight: profileTab === key ? 600 : 400,
    fontSize: '0.9rem',
    marginBottom: '-1px',
  });

  return (
    <section className="panel panel--profile-mobile">
      {/* Abas */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', marginBottom: '16px' }}>
        <button type="button" style={tabStyle('profile')} onClick={() => setProfileTab('profile')}>
          Perfil
        </button>
        <button type="button" style={tabStyle('premium')} onClick={() => setProfileTab('premium')}>
          {premiumActive ? '✦ Premium' : 'Premium'}
        </button>
        <button type="button" style={tabStyle('security')} onClick={() => setProfileTab('security')}>
          Segurança
        </button>
      </div>

      {/* Aba Premium */}
      {profileTab === 'premium' ? (
        apiClient ? (
          <PremiumOrdersHistory apiClient={apiClient} />
        ) : (
          <p style={{ opacity: 0.6 }}>Não disponível.</p>
        )
      ) : null}

      {/* Aba Segurança */}
      {profileTab === 'security' ? (
        <div className="panel" style={{ padding: '20px' }}>
          <h2 style={{ marginTop: 0 }}>Alterar senha</h2>
          <p className="auth-subtitle" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
            Informe sua senha atual e a nova senha para trocar.
          </p>
          <ChangePasswordForm apiClient={apiClient} />

          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '24px 0' }} />

          <h2>Alterar e-mail</h2>
          <p className="auth-subtitle" style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
            E-mail atual: <strong>{me?.email}</strong>
          </p>
          <p className="auth-subtitle" style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
            Informe o novo e-mail. Enviaremos um link de confirmacao para o novo endereco.
          </p>
          {emailChangeMsg ? (
            <p style={{ fontSize: '0.85rem', color: '#16a34a', marginBottom: '12px' }}>{emailChangeMsg}</p>
          ) : null}
          {emailChangeError ? (
            <p style={{ fontSize: '0.85rem', color: '#dc2626', marginBottom: '12px' }}>{emailChangeError}</p>
          ) : null}
          <form onSubmit={handleEmailChange} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="email"
              placeholder="novo@email.com"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              style={{ flex: '1 1 200px' }}
            />
            <button type="submit" className="btn btn--primary">Solicitar troca</button>
          </form>

          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '24px 0' }} />

          <h2>Cadastrar estabelecimento</h2>
          <p className="auth-subtitle" style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
            Tem um bar, restaurante ou balada? Cadastre seu estabelecimento na plataforma.
          </p>
          <a href="/admin" className="btn btn--ghost" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Ir para cadastro de estabelecimento
          </a>

          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '24px 0' }} />

          <h2>Termos e Privacidade (LGPD)</h2>
          <p className="auth-subtitle" style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
            Consulte os Termos de Uso e a Politica de Privacidade do Bilhete.
          </p>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setTermsModalOpen(true)}
          >
            Ver termos
          </button>

          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '24px 0' }} />

          <h2 style={{ color: '#dc2626' }}>Excluir conta</h2>
          <p className="auth-subtitle" style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
            A exclusao da conta e permanente e irreversivel. Todos os seus dados (perfil, bilhetes, chats, check-ins) serao removidos em conformidade com a LGPD.
          </p>
          {!deleteConfirmOpen ? (
            <button
              type="button"
              className="btn btn--ghost"
              style={{ color: '#dc2626', borderColor: '#dc2626' }}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              Quero excluir minha conta
            </button>
          ) : (
            <div style={{ marginTop: '12px' }}>
              {deleteError ? (
                <p style={{ fontSize: '0.85rem', color: '#dc2626', marginBottom: '12px' }}>{deleteError}</p>
              ) : null}
              <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>
                Confirme sua senha para excluir permanentemente sua conta:
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="password"
                  placeholder="Sua senha"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  style={{ flex: '1 1 200px' }}
                />
                <button
                  type="button"
                  className="btn btn--primary"
                  style={{ background: '#dc2626' }}
                  onClick={handleDeleteAccount}
                >
                  Excluir definitivamente
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setDeleteConfirmOpen(false);
                    setDeletePassword('');
                    setDeleteError('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <TermsModal open={termsModalOpen} onClose={() => setTermsModalOpen(false)} />

      {profileTab === 'profile' ? (
      <>
      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="profile-carousel" aria-label="Fotos do perfil">
          {form.photoUrls.map((photo, index) => (
            <article className="profile-photo-card" key={`${photo.slice(0, 24)}-${index}`}>
              <button
                type="button"
                className="profile-photo-card__image-btn"
                onClick={() => openImagePreview(index)}
                aria-label={`Ver foto ${index + 1}`}
              >
                <img src={photo} alt={`Foto ${index + 1} do perfil`} />
              </button>
              <span
                role="button"
                tabIndex={0}
                className="profile-photo-card__trash"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleRemovePhoto(index);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    handleRemovePhoto(index);
                  }
                }}
                aria-label={`Remover foto ${index + 1}`}
                title="Remover foto"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z" />
                </svg>
              </span>
              <div className="profile-photo-card__controls">
                <button
                  type="button"
                  className="profile-photo-card__move"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleMovePhotoLeft(index);
                  }}
                  disabled={index === 0}
                  aria-label="Mover para esquerda"
                  title="Mover para esquerda"
                >
                  ←
                </button>
                <button
                  type="button"
                  className="profile-photo-card__move"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleMovePhotoRight(index);
                  }}
                  disabled={index === form.photoUrls.length - 1}
                  aria-label="Mover para direita"
                  title="Mover para direita"
                >
                  →
                </button>
              </div>
            </article>
          ))}

          {form.photoUrls.length < 5 ? (
            <button type="button" className="profile-photo-add" onClick={handlePickPhoto} aria-label="Adicionar nova foto">
              +
            </button>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="visually-hidden"
            onChange={handlePhotoSelected}
          />
        </div>

        <label>
          Nome
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
        </label>

        <label>
          Idade
          <input
            type="number"
            min={18}
            max={99}
            value={form.age}
            onChange={(event) => setForm((prev) => ({ ...prev, age: event.target.value }))}
            required
          />
        </label>

        <div className="profile-intentions">
          <p>Intencao</p>
          <div className="badge-group" role="radiogroup" aria-label="Selecione sua intencao">
            {INTENTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={form.statusSocial === item.value}
                className={`badge-option ${form.statusSocial === item.value ? 'is-active' : ''}`}
                onClick={() => setForm((prev) => ({ ...prev, statusSocial: item.value }))}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="profile-save-wrap">
          <button type="submit" className="btn btn--primary btn--full">
            Salvar
          </button>
        </div>
      </form>

      {previewState.open ? (
        <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Preview da foto">
          <div className="panel admin-overlay__content admin-image-modal">
            <div className="admin-overlay__header">
              <h2>Preview da foto</h2>
              <button type="button" className="btn btn--ghost" onClick={closeImagePreview}>
                Fechar
              </button>
            </div>
            <div className="admin-image-preview">
              <img src={previewState.url} alt={previewState.alt} />
            </div>
            {form.photoUrls.length > 1 ? (
              <div className="admin-image-nav">
                <button type="button" className="btn btn--ghost" onClick={goToPreviousPreviewImage}>
                  ← Anterior
                </button>
                <span>
                  {previewState.index + 1} de {form.photoUrls.length}
                </span>
                <button type="button" className="btn btn--ghost" onClick={goToNextPreviewImage}>
                  Próxima →
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      </>
      ) : null}
    </section>
  );
}
