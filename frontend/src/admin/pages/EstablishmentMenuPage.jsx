import { useEffect, useRef, useState } from 'react';

import { adminApi } from '../api/adminClient';
import AppNotice from '../../components/AppNotice';
import Modal from '../../components/Modal';
import RestaurantMenuPreview from '../../components/RestaurantMenuPreview';

const createInitialMenuItem = () => ({
  name: '',
  description: '',
  price: '',
  category: '',
  imageUrl: '',
});

function formatPrice(value) {
  if (!value) {
    return '';
  }

  const cleanValue = String(value).replace(/\D/g, '');
  if (!cleanValue) {
    return '';
  }

  const numberValue = Number.parseInt(cleanValue, 10) / 100;
  return numberValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizePriceInputValue(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function toPayloadPrice(value) {
  const cleanValue = normalizePriceInputValue(value);
  if (!cleanValue) {
    return '';
  }

  const cents = Number.parseInt(cleanValue, 10);
  return (cents / 100).toFixed(2);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
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

export default function EstablishmentMenuPage({ hasApprovedLink = false }) {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [itemForm, setItemForm] = useState(createInitialMenuItem);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const imageInputRef = useRef(null);
  const existingCategories = Array.from(
    new Set((menuItems || []).map((item) => String(item.category || '').trim()).filter(Boolean)),
  );

  useEffect(() => {
    loadMenuItems();
  }, []);

  const loadMenuItems = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await adminApi.establishmentMenuItems();
      setMenuItems(data || []);
    } catch (requestError) {
      setFeedback(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setEditingItem(null);
    setError('');
    setFeedback('');
    setItemForm(createInitialMenuItem());
    setShowForm(true);
  };

  const handleEditItem = (item) => {
    const normalizedCategory = String(item.category || '').trim();
    setEditingItem(item);
    setItemForm({
      name: item.name || '',
      description: item.description || '',
      price: normalizePriceInputValue(item.price),
      category: normalizedCategory,
      imageUrl: item.imageUrl || '',
    });
    setShowForm(true);
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Tem certeza que deseja remover este item do cardápio?')) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      await adminApi.deleteMenuItem(itemId);
      setFeedback('Item removido com sucesso.');
      await loadMenuItems();
    } catch (requestError) {
      setFeedback(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (!String(file.type || '').startsWith('image/')) {
      setFeedback('Selecione um arquivo de imagem válido.');
      return;
    }

    setError('');
    try {
      const dataUrl = await fileToDataUrl(file);
      const optimizedDataUrl = await resizeDataUrlImage(dataUrl);
      setItemForm((prev) => ({ ...prev, imageUrl: optimizedDataUrl }));
    } catch (requestError) {
      setFeedback(requestError.message);
    }
  };

  const handleRemoveImage = () => {
    setItemForm((prev) => ({ ...prev, imageUrl: '' }));
  };

  const handlePriceChange = (event) => {
    setItemForm((prev) => ({ ...prev, price: normalizePriceInputValue(event.target.value) }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        name: itemForm.name.trim(),
        description: itemForm.description.trim(),
        price: toPayloadPrice(itemForm.price),
        category: itemForm.category.trim(),
        imageUrl: itemForm.imageUrl,
      };

      if (editingItem) {
        await adminApi.updateMenuItem(editingItem.id, payload);
        setFeedback('Item atualizado com sucesso.');
      } else {
        await adminApi.createMenuItem(payload);
        setFeedback('Item adicionado com sucesso.');
      }

      setItemForm(createInitialMenuItem());
      setEditingItem(null);
      setShowForm(false);
      await loadMenuItems();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setItemForm(createInitialMenuItem());
    setEditingItem(null);
    setShowForm(false);
  };

  if (!hasApprovedLink) {
    return (
      <section className="panel">
        <h2>Cardápio</h2>
        <p className="auth-subtitle">Você precisa ter um vínculo aprovado com um local para gerenciar o cardápio.</p>
      </section>
    );
  }

  return (
    <div className="admin-page-stack">
      <AppNotice
        message={feedback}
        type={feedback.includes('sucesso') ? 'success' : 'error'}
        floating
        autoHideMs={3500}
        onClose={() => setFeedback('')}
      />

      <section className="panel">
        <div className="inline-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Cardápio</h2>
          <div className="inline-row" style={{ gap: '8px' }}>
            <button type="button" className="btn btn--ghost" onClick={() => setShowPreview((prev) => !prev)}>
              {showPreview ? 'Ocultar pré-visualização' : 'Pré-visualizar'}
            </button>
            <button type="button" className="btn btn--primary" onClick={handleAddItem}>
              + Adicionar Item
            </button>
          </div>
        </div>

        {loading ? <p>Carregando cardápio...</p> : null}

        {!loading && !menuItems.length && !showForm ? (
          <p>Nenhum item no cardápio. Clique em "Adicionar Item" para começar.</p>
        ) : null}

        {!loading && menuItems.length > 0 ? (
          <div className="admin-menu-list">
            {menuItems.map((item) => (
              <div key={item.id} className="admin-menu-item">
                <div className="admin-menu-item__media">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="admin-menu-item__image" />
                  ) : (
                    <div className="admin-menu-item__image admin-menu-item__image--placeholder">
                      Sem foto
                    </div>
                  )}
                </div>
                <div className="admin-menu-item__content">
                  <div className="admin-menu-item__heading">
                    <h4>{item.name}</h4>
                    {item.price ? <span className="admin-menu-item__price">R$ {item.price}</span> : null}
                  </div>
                  {item.category ? <p className="admin-menu-item__category">{item.category}</p> : null}
                  <p className="admin-menu-item__description">{item.description}</p>
                </div>
                <div className="admin-menu-item__actions">
                  <button type="button" className="btn btn--ghost" onClick={() => handleEditItem(item)}>
                    Editar
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => handleDeleteItem(item.id)}>
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Pré-visualização do cardápio"
        className="restaurant-menu-preview-modal"
      >
        <RestaurantMenuPreview
          title="Menu do estabelecimento"
          subtitle="Uma visão inicial de como o cardápio aparecerá para os clientes."
          items={menuItems}
          emptyMessage="Adicione itens para ver a pré-visualização do menu."
        />
      </Modal>

      {showForm ? (
        <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Formulário de item do cardápio">
          <div className="panel admin-overlay__content">
            <div className="admin-overlay__header">
              <h3>{editingItem ? 'Editar Item' : 'Novo Item'}</h3>
              <button type="button" className="btn btn--ghost admin-overlay__close" onClick={handleCancel} aria-label="Fechar">
                ×
              </button>
            </div>
            <form className="admin-form admin-menu-form" onSubmit={handleSubmit}>
              <div className="admin-menu-form__image-column">
                <div className="admin-image-preview">
                  <button
                    type="button"
                    className="admin-logo-picker"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    {itemForm.imageUrl ? (
                      <img src={itemForm.imageUrl} alt="Preview da foto do item" />
                    ) : (
                      <span>Selecionar foto</span>
                    )}

                    {itemForm.imageUrl ? (
                      <span
                        role="button"
                        tabIndex={0}
                        className="admin-logo-picker__trash"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleRemoveImage();
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            handleRemoveImage();
                          }
                        }}
                        aria-label="Remover foto"
                        title="Remover foto"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z" />
                        </svg>
                      </span>
                    ) : null}
                  </button>
                </div>

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />
              </div>

              <div className="admin-menu-form__fields">
                <div className="admin-form__compact admin-form__compact--two">
                  <label>
                    Nome do item *
                    <input
                      value={itemForm.name}
                      onChange={(event) => setItemForm((prev) => ({ ...prev, name: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Preço
                    <input
                      type="text"
                      value={formatPrice(itemForm.price)}
                      onChange={handlePriceChange}
                      placeholder="0,00"
                    />
                  </label>
                </div>

                <label>
                  Categoria
                  <input
                    list="menu-item-categories"
                    value={itemForm.category}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, category: event.target.value }))}
                    placeholder="Ex.: Drinks, Hambúrgueres"
                  />
                  <datalist id="menu-item-categories">
                    {existingCategories.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </label>

                <label>
                  Descrição breve
                  <textarea
                    rows={4}
                    value={itemForm.description}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </label>

                <div className="admin-menu-form__actions">
                  <button type="submit" className="btn btn--primary" disabled={saving}>
                    {saving ? 'Salvando...' : editingItem ? 'Salvar' : 'Salvar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
