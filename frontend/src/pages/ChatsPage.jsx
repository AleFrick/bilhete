import { useEffect, useMemo, useRef, useState } from 'react';

function getChatAvatar(chat) {
  if (Array.isArray(chat?.otherUserPhotos) && chat.otherUserPhotos.length) {
    return chat.otherUserPhotos[0];
  }

  if (typeof chat?.otherUserPhotos === 'string') {
    try {
      const parsed = JSON.parse(chat.otherUserPhotos);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed[0];
      }
    } catch (error) {
      // Ignore invalid JSON and use fallback avatar.
    }
  }

  return 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=240&q=80';
}

export default function ChatsPage({ chats, messages, selectedChatId, onSelectChat, onSendMessage, currentUserId }) {
  const [newMessage, setNewMessage] = useState('');
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  const messagesEndRef = useRef(null);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) || null,
    [chats, selectedChatId]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, selectedChatId]);

  useEffect(() => {
    if (selectedChatId) {
      setIsThreadOpen(true);
    }
  }, [selectedChatId]);

  const handleSend = async () => {
    if (!selectedChatId || !newMessage.trim()) {
      return;
    }

    await onSendMessage(selectedChatId, newMessage.trim());
    setNewMessage('');
  };

  const handleComposerKeyDown = async (event) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    await handleSend();
  };

  const handleOpenChat = async (chatId) => {
    setIsThreadOpen(true);
    await onSelectChat(chatId);
  };

  const handleBackToList = () => {
    setIsThreadOpen(false);
  };

  return (
    <section className="panel chat-hub">
      <div className="chat-list-wrap">
        <h3>Conversas</h3>
        {!chats.length ? <p>Nenhum chat ativo.</p> : null}
        <ul className="chat-list">
          {chats.map((chat) => (
            <li key={chat.id}>
              <button
                type="button"
                className={`chat-list__item ${selectedChatId === chat.id ? 'is-active' : ''}`}
                onClick={() => handleOpenChat(chat.id)}
              >
                <img
                  src={getChatAvatar(chat)}
                  alt={`Foto de ${chat.otherUserName || 'contato'}`}
                  className="chat-list__avatar"
                />
                <span className="chat-list__meta">
                  <strong>{chat.otherUserName || 'Contato'}</strong>
                  <span>Bilhete em {chat.venueName}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {isThreadOpen ? (
        <section className="chat-overlay" role="dialog" aria-modal="false">
          {!selectedChat ? (
            <div className="chat-thread__empty">
              <p>Carregando conversa...</p>
            </div>
          ) : (
          <>
            <header className="chat-thread__header">
              <button
                type="button"
                className="btn btn--ghost btn--arrow"
                onClick={handleBackToList}
                aria-label="Voltar para conversas"
                title="Voltar"
              >
                ←
              </button>
              <img
                src={getChatAvatar(selectedChat)}
                alt={`Foto de ${selectedChat.otherUserName || 'contato'}`}
                className="chat-thread__avatar"
              />
              <div>
                <strong>{selectedChat.otherUserName || 'Contato'}</strong>
                <p>Bilhete em {selectedChat.venueName}</p>
              </div>
            </header>

            <div className="chat-messages">
              {messages.map((message) => {
                const isMine = message.senderId === currentUserId;

                return (
                  <article
                    key={message.id}
                    className={`chat-bubble-wrap ${isMine ? 'is-mine' : 'is-theirs'}`}
                  >
                    <div className={`chat-bubble ${isMine ? 'is-mine' : 'is-theirs'}`}>
                      <p>{message.message}</p>
                      <time>{new Date(message.createdAt).toLocaleTimeString()}</time>
                    </div>
                  </article>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <footer className="chat-composer">
              <input
                placeholder="Digite sua mensagem..."
                value={newMessage}
                onChange={(event) => setNewMessage(event.target.value)}
                onKeyDown={handleComposerKeyDown}
              />
              <button type="button" className="btn btn--primary" onClick={handleSend}>
                Enviar
              </button>
            </footer>
          </>
          )}
        </section>
      ) : null}
    </section>
  );
}
