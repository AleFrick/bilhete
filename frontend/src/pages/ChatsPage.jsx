import { useState } from 'react';

export default function ChatsPage({ chats, messages, selectedChatId, onSelectChat, onSendMessage }) {
  const [newMessage, setNewMessage] = useState('');

  const handleSend = async () => {
    if (!selectedChatId || !newMessage.trim()) {
      return;
    }

    await onSendMessage(selectedChatId, newMessage.trim());
    setNewMessage('');
  };

  return (
    <div className="page-stack two-col">
      <section className="panel">
        <h3>Conversas</h3>
        {!chats.length ? <p>Nenhum chat ativo.</p> : null}
        <ul className="simple-list">
          {chats.map((chat) => (
            <li key={chat.id}>
              <button
                type="button"
                className={`list-button ${selectedChatId === chat.id ? 'is-active' : ''}`}
                onClick={() => onSelectChat(chat.id)}
              >
                <strong>{chat.venueName}</strong>
                <p>Expira em: {new Date(chat.expiresAt).toLocaleString()}</p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>Mensagens</h3>
        {!selectedChatId ? <p>Selecione uma conversa.</p> : null}
        <div className="messages">
          {messages.map((message) => (
            <article key={message.id} className="message-item">
              <p>{message.message}</p>
              <time>{new Date(message.createdAt).toLocaleTimeString()}</time>
            </article>
          ))}
        </div>

        <div className="inline-row">
          <input
            placeholder="Digite uma mensagem"
            value={newMessage}
            onChange={(event) => setNewMessage(event.target.value)}
          />
          <button type="button" className="btn btn--primary" onClick={handleSend}>
            Enviar
          </button>
        </div>
      </section>
    </div>
  );
}
