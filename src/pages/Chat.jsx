import React, { useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import axios from 'axios'

const Chat = ({ socket }) => {
  const [selectedUser, setSelectedUser] = useState(null)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [receiverId, setReceiverId] = useState()
  const userId = window.localStorage.getItem('userId')

  const messagesEndRef = useRef(null)

  useEffect(() => {
    socket.emit('join', userId)
  }, [socket, userId])

  useEffect(() => {
    const handleNewMessage=()=>{
      setMessages((state) => [...state, { sender: message.sender, content: message.content }])
    }
    socket.on("newMessage", handleNewMessage)

    return () => {
      socket.off("newMessage",handleNewMessage)
    }
  }, [socket])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (e) => {
    e.preventDefault()

    if (!message.trim()) return

    setMessages(prev => [...prev, { content: message, sender: userId }])
    setMessage('')

    try {
      await axios.post(
        'https://chatapplication-api.onrender.com/chat/message/send/' + receiverId,
        { content: message },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('chat-token')}`
          }
        }
      )
    } catch (error) {
      console.log(error)
    }
  }

  return (
    <div className='min-h-screen flex flex-col md:flex-row bg-gray-900 text-gray-200'>

      {/* Sidebar */}
      <div className='w-full md:w-1/3 bg-gray-800 border-b md:border-r border-gray-700'>
        <Sidebar
          onSelectUser={setSelectedUser}
          setReceiverId={setReceiverId}
          setMessages={setMessages}
        />
      </div>

      {/* Chat Area */}
      <div className='w-full md:w-2/3 flex flex-col h-[calc(100vh-0px)]'>

        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className='p-4 border-b border-gray-700 bg-gray-800'>
              <h2 className='text-lg sm:text-xl font-semibold'>Chat with {selectedUser.name}</h2>
            </div>

            {/* Chat Messages */}
            <div className='flex-1 p-3 sm:p-4 overflow-y-auto space-y-2 flex flex-col bg-gray-900'>
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`p-2 rounded max-w-[80%] text-sm sm:text-base ${
                    msg.sender === userId
                      ? 'bg-blue-600 self-end text-white'
                      : 'bg-gray-700 self-start text-white'
                  }`}
                >
                  <p>{msg.content}</p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form
              onSubmit={handleSendMessage}
              className='p-2 sm:p-4 border-t border-gray-700 bg-gray-800 flex flex-col sm:flex-row items-center gap-2'
            >
              <input
                type='text'
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder='Type your message...'
                className='flex-1 p-2 rounded bg-gray-700 text-white placeholder-gray-400 border border-gray-600 w-full'
              />
              <button
                type='submit'
                className='bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full sm:w-auto'
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div className='flex-1 flex items-center justify-center text-gray-400 bg-gray-900'>
            <p className='text-xl sm:text-2xl font-semibold'>Start a chat</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Chat
