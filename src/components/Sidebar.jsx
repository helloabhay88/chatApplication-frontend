import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoSettingsOutline } from "react-icons/io5";

const Sidebar = ({ socket, onSelectUser, setReceiverId, setMessages, activeReceiverId }) => {
  const [users, setUsers] = useState([])
  const [filterUsers, setFilterUsers] = useState([])
  const navigate = useNavigate()
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!socket) return;

    const handleOnlineUsers = (userIds) => {
      setOnlineUsers(userIds);
    };

    const handleNewMessage = (newMessage) => {
      // If the message is not from the currently active user, increment unread count
      if (newMessage.sender !== activeReceiverId) {
        setUsers(prev => prev.map(u => 
          u._id === newMessage.sender ? { ...u, unreadCount: (u.unreadCount || 0) + 1 } : u
        ));
        setFilterUsers(prev => prev.map(u => 
          u._id === newMessage.sender ? { ...u, unreadCount: (u.unreadCount || 0) + 1 } : u
        ));
      }
    };

    socket.on('onlineUsers', handleOnlineUsers);
    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('onlineUsers', handleOnlineUsers);
      socket.off('newMessage', handleNewMessage);
    };
  }, [socket, activeReceiverId]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const users = await axios.get(`${import.meta.env.VITE_API_URL}/chat/users`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('chat-token')}`
          }
        })
        setUsers(users.data.users)
        setFilterUsers(users.data.users)
      } catch (error) {
        navigate('/')
        console.log(error)
      }
    }

    fetchUser()
  }, [])

  const handleLogout = () => {
    if (socket) {
      socket.disconnect(); // Disconnect socket so backend knows user left
    }
    window.localStorage.removeItem('chat-token')
    window.localStorage.removeItem('userId')
    window.location.href = '/';
  }

  const handleUserClick = (user) => {
    // Clear previous messages and set the new receiver
    setMessages([]);
    setReceiverId(user._id);
    onSelectUser(user);
    
    // Reset unread count locally when the chat is opened
    setUsers(prev => prev.map(u => u._id === user._id ? { ...u, unreadCount: 0 } : u));
    setFilterUsers(prev => prev.map(u => u._id === user._id ? { ...u, unreadCount: 0 } : u));
  }

  const handlefilter = (e) => {
    const search = e.target.value.toLowerCase();
    const filtered = users.filter((usr) =>
      usr.name.toLowerCase().includes(search)
    );
    setFilterUsers(filtered);
  };

  return (
    <div className='flex flex-col h-screen max-h-screen p-4 bg-gray-800 text-gray-200'>
      {/* Search Input - Fixed at top */}
      <div className='flex items-center gap-2 mb-4'>
        <input
          type="text"
          placeholder='Search'
          onChange={handlefilter}
          className='p-2 w-full rounded-xl border border-gray-600 bg-gray-700 text-white placeholder-gray-400'
        />
        <IoSettingsOutline className='text-gray-400 cursor-pointer hover:text-white' size={22}/>
      </div>

      {/* User List - Scrollable middle section */}
      <div className='flex-1 min-h-0 overflow-y-auto mb-4'>
        {filterUsers.length > 0 ? (
          <div className='space-y-4'>
  
            {filterUsers.map(user => (
              <div
                key={user._id}
                className='flex items-center space-x-3 cursor-pointer hover:bg-gray-700 p-3 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-95'
                onClick={() => handleUserClick(user)}
              >
                {user.image && user.image.trim() !== '' ? (
                  <img
                    src={`https://res.cloudinary.com/dqp7w0fvl/image/upload/v1752851774/${user.image}`}
                    width="40"
                    height="40"
                    className='rounded-full object-cover w-10 h-10'
                    alt={user.email}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white flex-shrink-0">
                    <span className="text-lg font-bold">{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <div className='flex flex-col flex-1 min-w-0'>
                  <div className="flex justify-between items-center w-full">
                    <span className='text-gray-200 truncate pr-2'>{user.name}</span>
                    {user.unreadCount > 0 && (
                      <span className='bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0'>
                        {user.unreadCount}
                      </span>
                    )}
                  </div>
                  {onlineUsers.includes(user._id) && (
                    <span className='text-green-400 text-sm'>● online</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className='text-gray-400'>No users</p>
        )}
      </div>
        
      {/* Logout Button - Fixed at bottom */}
      <div className='flex-shrink-0'>
        <button
          onClick={handleLogout}
          className='w-full bg-red-500/80 text-white py-3 rounded-xl hover:bg-red-600 transition-colors duration-200 font-medium'
        >
          Logout
        </button>
      </div>
    </div>
    
  )
}

export default Sidebar;
