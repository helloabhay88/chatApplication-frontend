import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiX, FiUser, FiSliders, FiLogOut, FiCamera, FiTrash2 } from 'react-icons/fi';

const SettingsModal = ({ isOpen, onClose, handleLogout, onProfileUpdate, currentUser }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [name, setName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [shouldDeletePhoto, setShouldDeletePhoto] = useState(false);
  
  // Audio/Video state
  const [mics, setMics] = useState([]);
  const [cams, setCams] = useState([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedCam, setSelectedCam] = useState('');

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setPreviewUrl(
        currentUser.image 
          ? `https://res.cloudinary.com/dqp7w0fvl/image/upload/v1752851774/${currentUser.image}` 
          : ''
      );
      setShouldDeletePhoto(false);
      setSelectedFile(null);
    }
  }, [currentUser, isOpen]);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        // Request permissions first to enumerate devices accurately
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const audioDevices = devices.filter(d => d.kind === 'audioinput');
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        
        setMics(audioDevices);
        setCams(videoDevices);
        
        if (audioDevices.length > 0) setSelectedMic(audioDevices[0].deviceId);
        if (videoDevices.length > 0) setSelectedCam(videoDevices[0].deviceId);
      } catch (err) {
        console.warn('Permissions denied or error loading media devices:', err);
      }
    };

    if (isOpen) {
      fetchDevices();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Profile picture size exceeds 2MB limit.");
        return;
      }
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await axios.put(
          `${import.meta.env.VITE_API_URL}/chat/user/profile`,
          formData,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('chat-token')}`,
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        if (response.data.message === 'success') {
          const updatedUser = response.data.user;
          setPreviewUrl(`https://res.cloudinary.com/dqp7w0fvl/image/upload/v1752851774/${updatedUser.image}`);
          setSelectedFile(null);
          setShouldDeletePhoto(false);
          if (onProfileUpdate) {
            onProfileUpdate(updatedUser);
          }
        }
      } catch (err) {
        console.error('Error uploading profile picture:', err);
        alert(err.response?.data?.message || 'Failed to upload profile picture');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeletePhoto = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete your profile picture?")) {
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('removeImage', 'true');

        const response = await axios.put(
          `${import.meta.env.VITE_API_URL}/chat/user/profile`,
          formData,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('chat-token')}`,
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        if (response.data.message === 'success') {
          const updatedUser = response.data.user;
          setPreviewUrl('');
          setSelectedFile(null);
          setShouldDeletePhoto(false);
          if (onProfileUpdate) {
            onProfileUpdate(updatedUser);
          }
        }
      } catch (err) {
        console.error('Error removing profile picture:', err);
        alert(err.response?.data?.message || 'Failed to remove profile picture');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Name is required");
      return;
    }
    // If name is unchanged, just close
    if (name.trim() === (currentUser?.name || '').trim()) {
      onClose();
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());

      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/chat/user/profile`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('chat-token')}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.message === 'success') {
        const updatedUser = response.data.user;
        localStorage.setItem('userName', updatedUser.name);
        if (onProfileUpdate) {
          onProfileUpdate(updatedUser);
        }
        alert('Name updated successfully!');
        onClose();
      }
    } catch (err) {
      console.error('Error updating name:', err);
      alert(err.response?.data?.message || 'Failed to update name');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[500px]">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700 bg-gray-850">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 transition"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="w-1/3 border-r border-gray-700 bg-gray-900/40 p-4 space-y-2">
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                activeTab === 'profile' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <FiUser size={18} />
              <span>Profile</span>
            </button>
            <button
              onClick={() => setActiveTab('devices')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                activeTab === 'devices' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <FiSliders size={18} />
              <span>Devices</span>
            </button>
            
            <div className="pt-4 border-t border-gray-700/60 mt-4">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-white hover:bg-red-600/80 transition"
              >
                <FiLogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative group">
                    {previewUrl ? (
                      <img 
                        src={previewUrl} 
                        className="w-24 h-24 rounded-full object-cover border-2 border-gray-600" 
                        alt="Avatar preview" 
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center text-white text-3xl font-bold border-2 border-gray-600">
                        {name ? name.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    {previewUrl && (
                      <button
                        type="button"
                        onClick={handleDeletePhoto}
                        className="absolute bottom-0 left-0 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full cursor-pointer shadow-md transition border-none flex items-center justify-center"
                        title="Delete Profile Picture"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    )}
                    <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 shadow-md transition">
                      <FiCamera size={14} />
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileChange} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                  <span className="text-xs text-gray-400">Click camera to change, trash to remove</span>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Display Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="Enter display name"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            )}

            {activeTab === 'devices' && (
              <div className="space-y-5">
                <h3 className="text-md font-semibold text-white">Call Devices</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Microphone Input</label>
                    {mics.length > 0 ? (
                      <select
                        value={selectedMic}
                        onChange={(e) => setSelectedMic(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-gray-600 bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      >
                        {mics.map(m => (
                          <option key={m.deviceId} value={m.deviceId}>{m.label || `Microphone ${m.deviceId.slice(0, 5)}`}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-gray-400">No microphones detected or permission not granted.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Camera Input</label>
                    {cams.length > 0 ? (
                      <select
                        value={selectedCam}
                        onChange={(e) => setSelectedCam(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-gray-600 bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      >
                        {cams.map(c => (
                          <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${c.deviceId.slice(0, 5)}`}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-gray-400">No cameras detected or permission not granted.</p>
                    )}
                  </div>
                </div>
                
                <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-xl">
                  <p className="text-xs text-blue-300 leading-relaxed">
                    Setting these preferences updates the default inputs used for real-time WebRTC audio and video calling.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
