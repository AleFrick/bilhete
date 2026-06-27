import { useEffect, useMemo, useState } from 'react';

function formatPreviewPrice(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number.parseFloat(String(value).replace(',', '.'));
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return `R$ ${parsed.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function RestaurantMenuPreview({
  title = 'Cardápio',
  subtitle = 'Seleções pensadas para oferecer uma experiência acolhedora.',
  items = [],
  emptyMessage = 'Este menu ainda está sendo preparado.',
}) {
  const [activeCategory, setActiveCategory] = useState('');

  const groupedItems = useMemo(() => {
    const grouped = items.reduce((accumulator, item) => {
      const category = String(item.category || 'Outros').trim() || 'Outros';
      if (!accumulator[category]) {
        accumulator[category] = [];
      }
      accumulator[category].push(item);
      return accumulator;
    }, {});

    const categories = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    return { grouped, categories };
  }, [items]);

  useEffect(() => {
    if (!groupedItems.categories.length) {
      setActiveCategory('');
      return;
    }

    if (!groupedItems.categories.includes(activeCategory)) {
      setActiveCategory(groupedItems.categories[0]);
    }
  }, [activeCategory, groupedItems.categories]);

  const currentCategory = groupedItems.categories.includes(activeCategory) ? activeCategory : groupedItems.categories[0] || '';

  return (
    <section className="restaurant-menu-preview">
      <div className="restaurant-menu-preview__hero">
        <div>
          <p className="restaurant-menu-preview__eyebrow">Menu</p>
          <h3 className="restaurant-menu-preview__title">{title}</h3>
          <p className="restaurant-menu-preview__subtitle">{subtitle}</p>
        </div>
      </div>

      {items.length ? (
        <>
          <div className="restaurant-menu-preview__tabs" role="tablist" aria-label="Categorias do cardápio">
            {groupedItems.categories.map((category) => (
              <button
                key={category}
                type="button"
                className={`restaurant-menu-preview__tab${currentCategory === category ? ' is-active' : ''}`}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="restaurant-menu-preview__page">
            <h4 className="restaurant-menu-preview__group-title">{currentCategory}</h4>
            <div className="restaurant-menu-preview__list">
              {(groupedItems.grouped[currentCategory] || []).map((item) => {
                const price = formatPreviewPrice(item.price);

                return (
                  <article key={item.id || item.name} className="restaurant-menu-preview__item">
                    <div className="restaurant-menu-preview__media">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="restaurant-menu-preview__image" />
                      ) : (
                        <div className="restaurant-menu-preview__placeholder">Sem foto</div>
                      )}
                    </div>

                    <div className="restaurant-menu-preview__content">
                      <div className="restaurant-menu-preview__heading">
                        <h5>{item.name}</h5>
                      </div>
                      {price ? <p className="restaurant-menu-preview__price">{price}</p> : null}
                      <p className="restaurant-menu-preview__description">
                        {item.description || 'Descrição em breve.'}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="restaurant-menu-preview__empty">
          <p>{emptyMessage}</p>
        </div>
      )}
    </section>
  );
}
