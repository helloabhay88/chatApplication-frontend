import React, { useEffect, useRef, useState, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import SettingsModal from '../components/SettingsModal';
import axios from 'axios';
import { FiMenu, FiVideo, FiPhoneOff, FiMic, FiMicOff, FiVideoOff, FiPhone, FiPaperclip, FiTrash2, FiFile, FiDownload, FiShare2 } from 'react-icons/fi';
import { SyncLoader } from 'react-spinners';

const BASE_URL = import.meta.env.VITE_API_URL;

const Chat = ({ socket }) => {
  // State for chat functionality
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [receiverId, setReceiverId] = useState();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const userId = window.localStorage.getItem('userId');
  const [currentUser, setCurrentUser] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Fetch current user details
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await axios.get(`${BASE_URL}/chat/user/me`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('chat-token')}`
          }
        });
        if (response.data.message === 'success') {
          setCurrentUser(response.data.user);
        }
      } catch (err) {
        console.error("Error fetching current user info:", err);
      }
    };
    if (userId) {
      fetchCurrentUser();
    }
  }, [userId, BASE_URL]);

  const handleLogout = () => {
    if (socket) {
      socket.disconnect();
    }
    window.localStorage.removeItem('chat-token');
    window.localStorage.removeItem('userId');
    window.location.href = '/';
  };
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // State for pagination and scrolling
  const [page, setPage] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const messagesLimit = 20; // Define how many messages to fetch at a time
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const loadingRef = useRef(false);
  const scrollHeightRef = useRef(0);
  const [isFetchingInitialMessages, setIsFetchingInitialMessages] = useState(false);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false);
  
  // WebRTC State
  const [stream, setStream] = useState();
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerName, setCallerName] = useState("");
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callType, setCallType] = useState('video');

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  const streamRef = useRef(null); // Add ref to hold stream to avoid stale closures

  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const screenStreamRef = useRef(null);

  // Attach local stream when it becomes available and the video element renders
  useEffect(() => {
    if (myVideo.current && stream) {
      myVideo.current.srcObject = stream;
    }
  }, [stream, isCalling, callAccepted]);

  // Refs for DOM elements
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const abortControllerRef = useRef(null); // Ref to hold the AbortController

  // IntersectionObserver to detect when the user scrolls to the top of the chat
  const observer = useRef(null);
  const topMessageRef = useRef(null);

  // --- Utility Effects ---
  // A heartbeat interval to keep the user's socket connection alive and signal they are active
  useEffect(() => {
    const interval = setInterval(() => {
      if (socket && userId) {
        socket.emit('heartbeat', userId);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [socket, userId]);

  // Handle browser tab visibility to emit online/offline events
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        socket.emit('user-online', userId);
      }
      // Do not emit user-offline when hidden, otherwise background sockets get deleted from the server's routing map!
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (document.visibilityState === 'visible') {
      socket.emit('user-online', userId);
    }
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [socket, userId]);

  // Set up listeners for typing indicators
  useEffect(() => {
    if (!socket || !userId) return;
    const handleUserTyping = ({ senderId }) => {
      //console.log("User typing event received", senderId, receiverId);
      if (senderId === receiverId) setIsTyping(true);
    };
    const handleUserStopTyping = ({ senderId }) => {
      if (senderId === receiverId) setIsTyping(false);
    };
    socket.on('userTyping', handleUserTyping);
    socket.on('userStopTyping', handleUserStopTyping);
    return () => {
      socket.off('userTyping', handleUserTyping);
      socket.off('userStopTyping', handleUserStopTyping);
    };
  }, [socket, userId, receiverId]);

  // Reset typing indicator when switching to a new user
  useEffect(() => {
    setIsTyping(false);
  }, [receiverId]);

  // Send a 'join' event to the server when the user connects
  useEffect(() => {
    if (socket && userId) {
      socket.emit('join', userId);
    }
  }, [socket, userId]);

  // Listen for the list of online users from the server
  useEffect(() => {
    if (!socket) return;
    const handleOnlineUsers = (userIds) => {
      setOnlineUsers(userIds);
    };
    socket.on('onlineUsers', handleOnlineUsers);
    return () => {
      socket.off('onlineUsers', handleOnlineUsers);
    };
  }, [socket]);

  // WebRTC Incoming Call Listener
  useEffect(() => {
    if (!socket) return;
    
    socket.on("callUser", (data) => {
      console.log("--> [Socket] Received 'callUser' event:", data);
      setReceivingCall(true);
      setCaller(data.from);
      setCallerName(data.name);
      setCallerSignal(data.signal);
      setCallType(data.callType || 'video');
    });

    socket.on("callAccepted", async (signal) => {
      console.log("--> [Socket] Received 'callAccepted'. Setting remote description.");
      setCallAccepted(true);
      if (connectionRef.current) {
        await connectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
      }
    });

    socket.on("ice-candidate", async (candidate) => {
      if (connectionRef.current) {
        try {
          await connectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("--> [WebRTC] Error adding received ICE candidate", e);
        }
      }
    });

    socket.on("callEnded", () => {
      console.log("--> [Socket] Received 'callEnded' event");
      endCall(false);
    });

    return () => {
      socket.off("callUser");
      socket.off("callAccepted");
      socket.off("ice-candidate");
      socket.off("callEnded");
    };
  }, [socket]);

  // Custom function to scroll to the bottom of the chat container
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'instant' });
    }
  };
  
  // --- Real-Time Messaging and Status Updates ---
  // The corrected useEffect to handle incoming messages in real-time.
  useEffect(() => {
    if (!socket || !userId) return;

    // CORRECTED LOGIC: Only add a new message if it's from the other person.
    const handleNewMessage = (newMessage) => {
      //console.log("New message received:", newMessage);
      if (newMessage.sender === receiverId) {
        setMessages(prevMessages => [...prevMessages, newMessage]);
        setShouldScrollToBottom(true);
      }
    };
    
    // This updates the 'seen' status of multiple messages in bulk.
    const handleMessagesSeenBulk = ({ seenBy }) => {
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.sender === userId && !msg.seen ? { ...msg, seen: true } : msg
        )
      );
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages(prevMessages => prevMessages.filter(msg => msg._id !== messageId));
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('messagesSeenBulk', handleMessagesSeenBulk);
    socket.on('messageDeleted', handleMessageDeleted);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messagesSeenBulk', handleMessagesSeenBulk);
      socket.off('messageDeleted', handleMessageDeleted);
    };
  }, [socket, userId, receiverId]);

  // --- Message Fetching & Pagination Logic ---

  // Function to fetch messages from the backend with pagination
  const fetchMessages = useCallback(async (currentPage, isInitialFetch = false) => {
    if (loadingRef.current || !selectedUser) return;
    
    if (!isInitialFetch && messagesContainerRef.current) {
        scrollHeightRef.current = messagesContainerRef.current.scrollHeight;
    }
    
    loadingRef.current = true;

    try {
      const skip = currentPage * messagesLimit;
      const res = await axios.get(
        `${BASE_URL}/chat/message/read/${selectedUser._id}?skip=${skip}&limit=${messagesLimit}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('chat-token')}`
          },
          // Pass the abort signal to the request
          signal: abortControllerRef.current.signal,
        }
      );
      
      const newMessages = res.data;
      
      // Update hasMoreMessages based on the number of messages returned
      if (newMessages.length < messagesLimit) {
        setHasMoreMessages(false);
      } else {
        setHasMoreMessages(true);
      }

      // For initial fetch, replace messages. For pagination, prepend.
      if (isInitialFetch) {
        setMessages(newMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
        setInitialLoadComplete(true);
      } else {
        setMessages(prev => {
          const combinedMessages = [...newMessages, ...prev];
          return combinedMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });
      }
      
    } catch (error) {
      // Ignore abort errors which happen when switching chats
      if (axios.isCancel(error) || error.name === 'AbortError') {
        console.log('Request aborted due to new user selection');
      } else {
        console.error('Error fetching messages:', error);
        setHasMoreMessages(false);
      }
    } finally {
      loadingRef.current = false;
      if (isInitialFetch) {
        setIsFetchingInitialMessages(false);
      }
    }
  }, [selectedUser, messagesLimit]);

  // Effect to handle user selection and initial message fetch
  useEffect(() => {
    if (selectedUser) {
      // Abort any ongoing request before starting a new one
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Clear messages and reset state immediately on new user selection
      setMessages([]);
      setPage(0);
      setHasMoreMessages(true);
      setInitialLoadComplete(false);
      setIsFetchingInitialMessages(true);
      
      // Fetch messages for the newly selected user
      fetchMessages(0, true);
    }

    // Cleanup function to abort the request if the component unmounts or selectedUser changes
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedUser, fetchMessages]);

  // Effect to perform initial scroll to bottom after messages are loaded for a new chat
  useEffect(() => {
    if (initialLoadComplete) {
      scrollToBottom();
    }
  }, [initialLoadComplete]);

  // Effect to observe the top of the chat window for pagination
  useEffect(() => {
    if (!initialLoadComplete || !topMessageRef.current || !hasMoreMessages) {
      return;
    }

    if (observer.current) {
        observer.current.disconnect();
    }
    
    observer.current = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loadingRef.current && hasMoreMessages) {
        setPage(prevPage => prevPage + 1);
      }
    }, {
      root: messagesContainerRef.current,
      threshold: 0.1,
    });
    
    observer.current.observe(topMessageRef.current);
    
    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [initialLoadComplete, hasMoreMessages, messages.length]);

  // Effect to fetch the next page of messages when the page state changes
  useEffect(() => {
    if (page > 0 && hasMoreMessages) {
      fetchMessages(page);
    }
  }, [page, fetchMessages, hasMoreMessages]);

  // Use a different effect for scrolling to keep scroll position during pagination
  useEffect(() => {
      if (messagesContainerRef.current && scrollHeightRef.current > 0) {
          const newScrollHeight = messagesContainerRef.current.scrollHeight;
          messagesContainerRef.current.scrollTop += newScrollHeight - scrollHeightRef.current;
          scrollHeightRef.current = 0; // Reset after use
      }
  }, [messages]);
  
  // New Effect to handle scrolling to bottom when a new message is sent or received
  useEffect(() => {
    if (shouldScrollToBottom) {
      scrollToBottom();
      setShouldScrollToBottom(false);
    }
  }, [shouldScrollToBottom]);

  // Clean up typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);
  
  // Mark unseen messages as seen when conversation is open
  useEffect(() => {
    if (!receiverId) return;
    const unseenMessages = messages.filter(m => m.sender === receiverId && !m.seen);
    
    if (unseenMessages.length > 0) {
      socket.emit('markMessagesSeen', { senderId: userId, receiverId });
      
      setMessages(prevMessages => 
        prevMessages.map(m => 
          m.sender === receiverId && !m.seen ? { ...m, seen: true } : m
        )
      );
    }
  }, [receiverId, messages, socket]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File size exceeds the 5MB limit.");
        return;
      }
      setSelectedFile(file);
      setFilePreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : 'file_placeholder');
    }
  };

  // Send message handler
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!message.trim() && !selectedFile) return;
    if (!receiverId) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit('stopTyping', { senderId: userId, receiverId });

    // Capture data and clear input immediately
    const tempId = Date.now();
    const messageContent = message;
    const fileToSend = selectedFile;
    const previewUrl = filePreview;
    
    setMessage('');
    setSelectedFile(null);
    setFilePreview(null);
    
    if (fileToSend) {
      // Add a temporary message for the file upload to the UI immediately
      const tempMessage = {
        _id: tempId,
        sender: userId,
        content: messageContent,
        messageType: fileToSend.type.startsWith('image/') ? 'image' : 'file',
        fileUrl: previewUrl, // Use local blob URL for immediate preview
        fileName: fileToSend.name,
        createdAt: new Date(),
        pending: true,
        uploading: true
      };
      setMessages(prev => [...prev, tempMessage]);
      setShouldScrollToBottom(true);

      // Perform upload in background
      (async () => {
        try {
          const formData = new FormData();
          formData.append('file', fileToSend);

          const response = await axios.post(`${BASE_URL}/chat/message/upload`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
              'Authorization': `Bearer ${localStorage.getItem('chat-token')}`
            }
          });

          const { url, name, type, publicId } = response.data;

          const payload = {
            senderId: userId,
            receiverId,
            messageType: type,
            fileUrl: url,
            fileName: name,
            publicId: publicId,
          };
          if (messageContent) {
            payload.content = messageContent;
          }

          socket.emit('sendMessage', payload, (res) => {
            if (res && res.success) {
              setMessages(prev => prev.map(msg => msg._id === tempId ? res.message : msg));
              setShouldScrollToBottom(true);
            } else {
              console.error('Error sending file message via socket:', res?.error);
              setMessages(prev => prev.map(msg => msg._id === tempId ? { ...msg, pending: false, error: true, uploading: false } : msg));
            }
          });
        } catch (err) {
          console.error("Error uploading file:", err);
          setMessages(prev => prev.map(msg => msg._id === tempId ? { ...msg, pending: false, error: true, uploading: false } : msg));
        }
      })();
    } else {
      const tempMessage = {
        _id: tempId,
        sender: userId,
        content: messageContent,
        messageType: 'text',
        createdAt: new Date(),
        pending: true
      };
      
      // Add the temporary message to the UI
      setMessages(prev => [...prev, tempMessage]);
      setShouldScrollToBottom(true);
      
      // Fire the socket event for sending the message
      socket.emit('sendMessage', { senderId: userId, receiverId, content: messageContent, messageType: 'text' }, (response) => {
        if (response && response.success) {
          setMessages(prev =>
            prev.map(msg => msg._id === tempId ? response.message : msg)
          );
        } else {
          console.error('Error sending message via socket:', response?.error);
          setMessages(prev =>
            prev.map(msg => msg._id === tempId ? { ...msg, pending: false, error: true } : msg)
          );
        }
      });
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm("Are you sure you want to delete this message?")) {
      return;
    }
    try {
      // Filter out immediately for responsiveness
      setMessages(prev => prev.filter(msg => msg._id !== messageId));

      await axios.delete(`${BASE_URL}/chat/message/delete/${messageId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('chat-token')}`
        }
      });
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);

        const screenTrack = screenStream.getVideoTracks()[0];

        if (connectionRef.current) {
          const transceivers = connectionRef.current.getTransceivers();
          const videoSender = transceivers.find(t => t.receiver.track.kind === 'video')?.sender;
          if (videoSender) {
            await videoSender.replaceTrack(screenTrack);
          }
        }

        screenTrack.onended = () => {
          stopScreenShare();
        };

        const audioTracks = stream ? stream.getAudioTracks() : [];
        const combinedStream = new MediaStream([screenTrack, ...audioTracks]);
        setStream(combinedStream);
        streamRef.current = combinedStream;

      } catch (err) {
        console.error("Error starting screen share:", err);
      }
    }
  };

  const stopScreenShare = async () => {
    try {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);

      let cameraStream = null;
      let cameraTrack = null;

      // Only attempt to turn the camera back on if it was originally a video call
      if (callType === 'video') {
        try {
          cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          cameraTrack = cameraStream.getVideoTracks()[0];
          setStream(cameraStream);
          streamRef.current = cameraStream;
        } catch (err) {
          console.warn("Could not revert to camera, falling back to audio only");
          cameraStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          setStream(cameraStream);
          streamRef.current = cameraStream;
        }
      } else {
        // If it was an audio call, we just revert to audio-only stream
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setStream(cameraStream);
        streamRef.current = cameraStream;
      }

      if (connectionRef.current) {
        const transceivers = connectionRef.current.getTransceivers();
        const videoSender = transceivers.find(t => t.receiver.track.kind === 'video')?.sender;
        if (videoSender) {
          // Replace with camera track if available, or null to disable the video channel completely
          await videoSender.replaceTrack(cameraTrack || null);
        }
        
        // Ensure audio track is preserved
        const audioTrack = cameraStream.getAudioTracks()[0];
        const audioSender = transceivers.find(t => t.receiver.track.kind === 'audio')?.sender;
        if (audioSender && audioTrack) {
          await audioSender.replaceTrack(audioTrack);
        }
      }
    } catch (err) {
      console.error("Error stopping screen share and reverting media:", err);
    }
  };

  // --- WebRTC Native Functions ---
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  };

  const createPeerConnection = (isInitiator, currentStream) => {
    const pc = new RTCPeerConnection(iceServers);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          target: isInitiator ? receiverId : caller,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      if (userVideo.current) {
        // If there's an existing stream, add the track, otherwise set the srcObject
        if (userVideo.current.srcObject) {
          event.streams[0].getTracks().forEach(t => userVideo.current.srcObject.addTrack(t));
        } else {
          userVideo.current.srcObject = event.streams[0];
        }
      }
    };

    // Pre-negotiate both audio and video channels so we can dynamically add a screen share track during an audio call without needing a complex SDP renegotiation
    // ONLY do this if we are initiating the call! The receiver automatically creates transceivers based on the incoming offer.
    if (isInitiator) {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      pc.addTransceiver('video', { direction: 'sendrecv' });
    }

    if (currentStream) {
      const audioTrack = currentStream.getAudioTracks()[0];
      const videoTrack = currentStream.getVideoTracks()[0];
      
      if (isInitiator) {
        const transceivers = pc.getTransceivers();
        const audioTransceiver = transceivers.find(t => t.receiver.track.kind === 'audio');
        const videoTransceiver = transceivers.find(t => t.receiver.track.kind === 'video');

        if (audioTrack && audioTransceiver) audioTransceiver.sender.replaceTrack(audioTrack);
        if (videoTrack && videoTransceiver) videoTransceiver.sender.replaceTrack(videoTrack);
      } else {
        // If answering, just add the tracks normally! They will automatically map to the transceivers from the remote offer.
        if (audioTrack) pc.addTrack(audioTrack, currentStream);
        if (videoTrack) pc.addTrack(videoTrack, currentStream);
      }
    }

    return pc;
  };

  const startCall = async (type = 'video') => {
    console.log(`--> [WebRTC] startCall initiated. Type: ${type}. Requesting media devices...`);
    setCallType(type);
    try {
      let currentStream = null;
      try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
      } catch (mediaErr) {
        console.warn("--> [WebRTC] Could not get requested video/audio, falling back to audio only...", mediaErr);
        try {
          currentStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          setIsVideoOff(true);
        } catch (audioErr) {
          console.warn("--> [WebRTC] Total media failure (no mic/cam or permission denied). Proceeding in receive-only mode.");
          setIsVideoOff(true);
          setIsMuted(true);
        }
      }
      console.log("--> [WebRTC] Media stream obtained (or null).");
      setStream(currentStream);
      streamRef.current = currentStream;
      setIsCalling(true);
      setCallEnded(false);
      
      const pc = createPeerConnection(true, currentStream);
      connectionRef.current = pc;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log("--> [WebRTC] Emitting 'callUser' socket event to", receiverId);
      socket.emit("callUser", {
        userToCall: receiverId,
        signalData: offer,
        from: userId,
        name: window.localStorage.getItem('userName') || "User",
        callType: type
      });
    } catch (err) {
      console.error("--> [WebRTC] Fatal error initiating call:", err);
      alert("An error occurred while trying to start the call.");
    }
  };

  const toggleMute = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const answerCall = async () => {
    setCallAccepted(true);
    setCallEnded(false);
    
    try {
      let currentStream = null;
      try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: callType === 'video', audio: true });
      } catch (mediaErr) {
        console.warn("--> [WebRTC] Could not get requested video/audio for answer, falling back to audio only...", mediaErr);
        try {
          currentStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          setIsVideoOff(true);
        } catch (audioErr) {
          console.warn("--> [WebRTC] Total media failure on answer. Proceeding in receive-only mode.");
          setIsVideoOff(true);
          setIsMuted(true);
        }
      }
      setStream(currentStream);
      streamRef.current = currentStream;

      const pc = createPeerConnection(false, currentStream);
      connectionRef.current = pc;

      await pc.setRemoteDescription(new RTCSessionDescription(callerSignal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answerCall", { signal: answer, to: caller });
    } catch (err) {
      console.error("--> [WebRTC] Fatal error answering call:", err);
    }
  };

  const endCall = (emit = true) => {
    setCallEnded(true);
    setIsCalling(false);
    setCallAccepted(false);
    setReceivingCall(false);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }
    
    // Use streamRef to avoid stale closure issues from the socket listener
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Also stop state stream just in case
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    if (myVideo.current) myVideo.current.srcObject = null;
    if (userVideo.current) userVideo.current.srcObject = null;
    
    setStream(null);
    
    if (emit) {
        socket.emit("endCall", { to: isCalling ? receiverId : caller });
    }
  };

  // Typing handler
  const handleTyping = () => {
    if (!socket || !userId || !receiverId) return;
    socket.emit('typing', { senderId: userId, receiverId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', { senderId: userId, receiverId });
    }, 1500);
  };
  
  const isReceiverOnline = selectedUser && onlineUsers.includes(selectedUser._id);

  return (
    <div className='h-[100dvh] w-full flex flex-col md:flex-row bg-gray-900 text-gray-200 overflow-hidden'>

      {/* Mobile Header */}
      <div className='md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 rounded-b-lg shadow-lg'>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className='text-white p-2 rounded-full hover:bg-gray-700'>
          <FiMenu size={24} />
        </button>
        <h2 className='text-lg font-semibold truncate max-w-[70%]'>
          {selectedUser ? (
            <>
              {selectedUser.name}
              <span className={`ml-2 text-sm ${isReceiverOnline ? 'text-green-400' : 'text-gray-400'}`}>
                ● {isReceiverOnline ? 'Online' : 'Offline'}
              </span>
            </>
          ) : 'Chat'}
        </h2>
        <div className="flex items-center justify-end min-w-[2rem] gap-2">
          {selectedUser && isReceiverOnline && (
            <>
              <button 
                onClick={() => startCall('audio')} 
                className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 transition duration-150"
                title="Start Audio Call"
              >
                <FiPhone size={18} />
              </button>
              <button 
                onClick={() => startCall('video')} 
                className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 transition duration-150"
                title="Start Video Call"
              >
                <FiVideo size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className={`
        fixed md:static top-0 left-0 h-full md:h-screen w-[85%] sm:w-1/2 md:w-1/3 bg-gray-800 border-r border-gray-700 z-[60]
        transform transition-transform duration-300 ease-in-out rounded-r-lg shadow-xl
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <Sidebar
          socket={socket}
          onSelectUser={(user) => {
            setSelectedUser(user);
            setSidebarOpen(false);
          }}
          setMessages={setMessages}
          setReceiverId={setReceiverId}
          activeReceiverId={receiverId}
          currentUser={currentUser}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </div>

      {sidebarOpen && (
        <div
          className='fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden'
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Main Chat Area */}
      <div className='w-full md:w-2/3 flex flex-col h-screen relative'>
        {selectedUser ? (
          isFetchingInitialMessages ? (
            <div className='flex-1 flex items-center justify-center bg-gray-900'>
              <SyncLoader color="#3B82F6" size={8} />
            </div>
          ) : (
            <>
              {/* Desktop Header */}
              <div className='hidden md:flex p-4 border-b border-gray-700 bg-gray-800 rounded-b-lg shadow-md justify-between items-center'>
                <h2 className='text-lg sm:text-xl font-semibold'>
                  Chat with {selectedUser.name}
                  <span className={`ml-2 text-sm ${isReceiverOnline ? 'text-green-400' : 'text-gray-400'}`}>
                    ● {isReceiverOnline ? 'online' : 'offline'}
                  </span>
                </h2>
                <div className="flex gap-2">
                  {isReceiverOnline && (
                    <>
                      <button 
                        onClick={() => startCall('audio')} 
                        className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 transition duration-150"
                        title="Start Audio Call"
                      >
                        <FiPhone size={20} />
                      </button>
                      <button 
                        onClick={() => startCall('video')} 
                        className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 transition duration-150"
                        title="Start Video Call"
                      >
                        <FiVideo size={20} />
                      </button>
                    </>
                  )}
                </div>
              </div>



              {/* Messages */}
              <div
                ref={messagesContainerRef}
                className='flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 flex flex-col bg-gray-900 min-h-0 pt-16 md:pt-0 pb-4'
              >
                {hasMoreMessages && messages.length > 0 && (
                  <div ref={topMessageRef} className="flex justify-center my-2">
                    <SyncLoader color="#3B82F6" size={8} />
                  </div>
                )}
                {messages.map((msg, index) => (
                  <div key={msg._id} className={`flex w-full group ${msg.sender === userId ? 'justify-end' : 'justify-start'}`}>
                    {msg.sender === userId && (
                      <button
                        onClick={() => handleDeleteMessage(msg._id)}
                        className="mr-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 text-red-400 hover:text-red-300 p-1.5 rounded-full hover:bg-gray-800/50 transition-opacity duration-200 flex items-center justify-center self-center"
                        title="Delete Message"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    )}
                    <div
                      className={`p-3 rounded-lg max-w-[80%] text-sm sm:text-base shadow-md flex flex-col
                        ${msg.sender === userId
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-white'
                        }`}
                    >
                      {msg.messageType === 'image' ? (
                        <div className="space-y-2">
                          <img
                            src={msg.fileUrl?.startsWith('http') ? msg.fileUrl : `https://res.cloudinary.com/dqp7w0fvl/image/upload/v1752851774/${msg.fileUrl}`}
                            alt={msg.fileName || "Image"}
                            className="max-w-full rounded cursor-pointer hover:opacity-90 max-h-60 object-contain"
                            onClick={() => setLightboxImage(msg.fileUrl?.startsWith('http') ? msg.fileUrl : `https://res.cloudinary.com/dqp7w0fvl/image/upload/v1752851774/${msg.fileUrl}`)}
                          />
                          {msg.content && <p className="break-words whitespace-pre-wrap">{msg.content}</p>}
                        </div>
                      ) : msg.messageType === 'file' ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 bg-gray-800/50 p-3 rounded-lg border border-gray-700 max-w-sm">
                            <FiFile className="text-blue-400 flex-shrink-0" size={24} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate text-gray-200">{msg.fileName}</p>
                              <a
                              href={msg.fileUrl?.startsWith('http') ? msg.fileUrl : `https://res.cloudinary.com/dqp7w0fvl/image/upload/v1752851774/${msg.fileUrl}.${msg.fileName?.split('.').pop() || 'pdf'}`}
                              download={msg.fileName}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1 font-semibold"
                            >
                                <FiDownload size={12} className="inline mr-1" /> Download
                              </a>
                            </div>
                          </div>
                          {msg.content && <p className="break-words whitespace-pre-wrap">{msg.content}</p>}
                        </div>
                      ) : (
                        <p className="break-words whitespace-pre-wrap">{msg.content}</p>
                      )}

                      {msg.uploading && (
                        <div className="flex items-center gap-2 mt-2">
                          <SyncLoader color={msg.sender === userId ? "#ffffff" : "#3B82F6"} size={5} />
                          <span className="text-xs opacity-80">Uploading...</span>
                        </div>
                      )}
                      {!msg.uploading && msg.pending && <span className="text-gray-400 text-sm"> sending...</span>}
                      {msg.sender === userId && msg.seen && (
                        <span className="text-xs text-gray-300 mt-1 block text-right">
                          ✓ seen
                        </span>
                      )}
                      {msg.sender === userId && msg.error && (
                        <span className="text-xs text-red-400 mt-1 block text-right">
                          Failed to send
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className='flex-shrink-0 p-3 sm:p-4 border-t border-gray-700 bg-gray-800 shadow-lg flex flex-col justify-center'>
                <div className='w-full max-w-4xl mx-auto flex flex-col justify-center'>
                  {isTyping && (
                    <div className="text-sm text-gray-400 mb-2 transition-opacity duration-300 self-start">
                      <span className="animate-pulse">Typing...</span>
                    </div>
                  )}
                  {filePreview && (
                    <div className="flex items-center gap-3 mb-2 bg-gray-700 p-2 rounded-lg max-w-xs relative self-start">
                      {filePreview === 'file_placeholder' ? (
                        <div className="w-12 h-12 bg-gray-600 flex items-center justify-center rounded">
                          <FiFile size={24} className="text-gray-300" />
                        </div>
                      ) : (
                        <img src={filePreview} alt="Preview" className="w-12 h-12 object-cover rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-200 truncate">{selectedFile?.name}</p>
                        <p className="text-[10px] text-gray-400">{(selectedFile?.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          setFilePreview(null);
                        }}
                        className="text-red-400 hover:text-red-500 font-bold px-2"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <form 
                    onSubmit={handleSendMessage}
                    className='flex items-center gap-3 w-full'
                  >
                    <label
                      htmlFor="file-upload"
                      className='cursor-pointer text-gray-400 hover:text-white rounded-full hover:bg-gray-700 flex items-center justify-center flex-shrink-0 w-12 h-12 transition-colors'
                      title="Attach file or image"
                    >
                      <FiPaperclip size={20} />
                    </label>
                    <input
                      id="file-upload"
                      type='file'
                      className='hidden'
                      onChange={handleFileSelect}
                    />
                    <input
                      type='text'
                      value={message}
                      onChange={(e) => { setMessage(e.target.value); handleTyping(); }}
                      placeholder='Type your message...'
                      className='flex-1 min-w-0 px-4 h-12 rounded-full bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    />
                    <button
                      type='submit'
                      disabled={!message.trim() && !selectedFile}
                      className='bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white px-6 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-colors'
                    >
                      Send
                    </button>
                  </form>
                </div>
              </div>
            </>
          )
        ) : (
          <div className='flex-1 flex items-center justify-center text-gray-400 bg-gray-900 pt-16 md:pt-0'>
            <div className='text-center px-4'>
              <p className='text-xl sm:text-2xl font-semibold mb-2'>Select a user to start chatting!</p>
              <p className='text-sm sm:text-base opacity-75'>Choose a contact from the sidebar to begin your conversation</p>
            </div>
          </div>
        )}
      </div>

      {/* --- MOVED WEBRTC OVERLAYS --- */}
      {/* Incoming Call UI */}
      {receivingCall && !callAccepted && (
        <div className="absolute top-20 right-4 z-[60] bg-gray-800 p-5 rounded-xl shadow-2xl border border-gray-600 flex flex-col items-center transform transition-all">
          <h3 className="text-white font-semibold mb-4 text-lg">{callerName || 'Someone'} is calling... ({callType})</h3>
          <div className="flex gap-4">
            <button onClick={answerCall} className="bg-green-500 hover:bg-green-600 px-6 py-2 rounded-lg text-white font-medium shadow">Answer</button>
            <button onClick={() => endCall(true)} className="bg-red-500 hover:bg-red-600 px-6 py-2 rounded-lg text-white font-medium shadow">Decline</button>
          </div>
        </div>
      )}

      {/* Active Call Overlay */}
      {(isCalling || callAccepted) && !callEnded && (
        <div className="absolute inset-0 z-[60] bg-gray-900 flex flex-col p-4">
          <div className="flex-1 flex flex-col md:flex-row gap-4 relative">
            {/* Remote Media */}
            {callAccepted ? (
              <div className="flex-1 bg-black rounded-lg overflow-hidden flex items-center justify-center border border-gray-700 shadow-inner relative">
                <video playsInline ref={userVideo} autoPlay className={`w-full h-full object-contain ${callType === 'audio' ? 'hidden' : ''}`} />
                {callType === 'audio' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.8)] animate-pulse">
                      <FiPhone size={40} className="text-white" />
                    </div>
                    <p className="text-xl font-semibold text-gray-300 tracking-wide">Audio Call</p>
                  </div>
                )}
              </div>
            ) : (
              isCalling && (
                <div className="flex-1 bg-black rounded-lg overflow-hidden flex flex-col items-center justify-center border border-gray-700 shadow-inner relative">
                  <SyncLoader color="#3B82F6" />
                  <p className="mt-6 text-gray-400 text-lg animate-pulse">Ringing {selectedUser?.name || 'User'}...</p>
                </div>
              )
            )}
      
            {/* Local Media (PiP) */}
            {stream && (
              <div className={`absolute top-4 right-4 md:bottom-4 md:top-auto md:right-4 w-28 h-40 md:w-48 md:h-64 bg-black rounded-xl overflow-hidden shadow-2xl border-2 border-gray-600 z-50 ${callType === 'audio' ? 'hidden' : ''}`}>
                <video playsInline muted ref={myVideo} autoPlay className="w-full h-full object-cover" />
              </div>
            )}

            {/* Call Controls */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 md:gap-6 z-50 bg-gray-900/60 p-3 md:p-4 rounded-full backdrop-blur-md shadow-2xl border border-gray-700">
              <button
                onClick={toggleMute}
                className={`p-3 md:p-4 rounded-full shadow-lg transition-all hover:scale-110 flex items-center justify-center ${isMuted ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <FiMicOff size={22} /> : <FiMic size={22} />}
              </button>
              
              <button
                onClick={() => endCall(true)}
                className="bg-red-600 hover:bg-red-700 text-white p-4 md:p-5 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.6)] transition-all hover:scale-110 flex items-center justify-center group"
                title="End Call"
              >
                <FiPhoneOff size={26} className="group-hover:animate-pulse" />
              </button>

              <button
                onClick={toggleVideo}
                className={`p-3 md:p-4 rounded-full shadow-lg transition-all hover:scale-110 flex items-center justify-center ${isVideoOff ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
              >
                {isVideoOff ? <FiVideoOff size={22} /> : <FiVideo size={22} />}
              </button>

              {callAccepted && (
                <button
                  onClick={toggleScreenShare}
                  className={`p-3 md:p-4 rounded-full shadow-lg transition-all hover:scale-110 flex items-center justify-center ${isScreenSharing ? 'bg-green-600 text-white shadow-[0_0_15px_rgba(22,163,74,0.5)]' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                  title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
                >
                  <FiShare2 size={22} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] bg-black bg-opacity-95 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-5xl max-h-screen" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImage} alt="Expanded view" className="max-w-full max-h-[90vh] object-contain rounded" />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 text-white bg-gray-800 hover:bg-gray-700 p-2 rounded-full font-bold text-xl transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        handleLogout={handleLogout}
        onProfileUpdate={(updatedUser) => setCurrentUser(updatedUser)}
        currentUser={currentUser}
      />
    </div>
  );
};

export default Chat;
