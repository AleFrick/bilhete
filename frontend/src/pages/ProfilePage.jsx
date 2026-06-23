import { useEffect, useRef, useState } from 'react';

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

export default function ProfilePage({ me, onSave }) {
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    name: me?.name || '',
    age: me?.age || '',
    photoUrls: parsePhotoUrls(me?.photoUrls),
    statusSocial: me?.statusSocial || 'observando',
  });

  useEffect(() => {
    setForm({
      name: me?.name || '',
      age: me?.age || '',
      photoUrls: parsePhotoUrls(me?.photoUrls),
      statusSocial: me?.statusSocial || 'observando',
    });
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
        photoUrls: [...prev.photoUrls, optimizedDataUrl].slice(0, 8),
      }));
    } catch (error) {
      // Keep silent; user can try selecting the image again.
    } finally {
      event.target.value = '';
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

  return (
    <section className="panel panel--profile-mobile">
      <h3>Perfil</h3>

      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="profile-carousel" aria-label="Fotos do perfil">
          {form.photoUrls.map((photo, index) => (
            <article className="profile-photo-card" key={`${photo.slice(0, 24)}-${index}`}>
              <img src={photo} alt={`Foto ${index + 1} do perfil`} />
            </article>
          ))}

          <button type="button" className="profile-photo-add" onClick={handlePickPhoto} aria-label="Adicionar nova foto">
            +
          </button>

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
    </section>
  );
}
