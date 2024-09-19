import './App.css';

import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { FaUser, FaLock, FaPaperPlane, FaBars, FaTimes, FaCircle, FaInfoCircle, FaMoon, FaSun, FaPaperclip, FaEllipsisV, FaSignOutAlt, FaKey, FaShieldAlt } from 'react-icons/fa';

function App() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [offlineUsers, setOfflineUsers] = useState([]);
  const [currentChat, setCurrentChat] = useState('leaf');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const messagesEndRef = useRef(null);
  const socketInitialized = useRef(false);
  const fileInputRef = useRef(null);
  const profilePictureInputRef = useRef(null);
  const previousOnlineUsers = useRef([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [inviteKey, setInviteKey] = useState('');

  useEffect(() => {
    checkSession();
    fetchAllUsers();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (socket) {
      const handleConnect = () => console.log('Socket connected');
      const handleDisconnect = () => console.log('Socket disconnected');

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);

      return () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
      };
    }
  }, [socket]);

  useEffect(() => {
    if (isLoggedIn && currentUser && !socketInitialized.current) {
      initializeSocket(currentUser.name);
    }
  }, [isLoggedIn, currentUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const checkSession = async () => {
    try {
      const response = await fetch('http://172.20.10.8:3001/api/v1/users/session', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.username && data.username !== "null") {
        const userData = await fetchUserData(data.username);
        if (userData) {
          setCurrentUser({
            name: userData.username,
            nickname: userData.nickname || userData.username,
            avatar: userData.profilePicture || 'https://via.placeholder.com/50',
            status: 'online',
            isAdmin: userData.isAdmin
          });
          setIsLoggedIn(true);
        }
      }
    } catch (error) {
      console.error('Error checking session:', error);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await fetch('http://172.20.10.8:3001/api/v1/users');
      const users = await response.json();
      setOfflineUsers(users.map(user => ({
        ...user,
        nickname: user.nickname || user.username
      })));
    } catch (error) {
      console.error('Error fetching all users:', error);
    }
  };

  const fetchUserData = async (username) => {
    try {
      const response = await fetch(`http://172.20.10.8:3001/api/v1/userdata/user/${username}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      const userData = await response.json();
      return userData.user;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  const initializeSocket = (username) => {
    if (socketInitialized.current) {
      console.log('Socket already initialized');
      return;
    }

    console.log('Initializing socket for user:', username);
    const newSocket = io('http://172.20.10.8:3001');
    setSocket(newSocket);
    socketInitialized.current = true;

    newSocket.on('connect', () => {
      console.log('Socket connected successfully');
      newSocket.emit('user joined', username);
    });

    newSocket.on('chat message', (msg) => {
      setMessages((prevMessages) => [...prevMessages, msg]);
    });

    newSocket.emit('request previous messages');

    newSocket.on('chat messages', (msgs) => {
      setMessages(msgs);
    });

    newSocket.on('update users', async (updatedUsers) => {
      const onlineUsersData = await Promise.all(updatedUsers.map(async (user) => {
        const userData = await fetchUserData(user);
        return userData ? {
          username: user,
          nickname: userData.nickname || userData.username,
          profilePicture: userData.profilePicture || 'https://via.placeholder.com/36',
          isAdmin: userData.isAdmin
        } : null;
      }));
      
      const filteredOnlineUsers = onlineUsersData.filter(user => user !== null);

      // Find users who went offline
      const newOfflineUsers = previousOnlineUsers.current.filter(
        user => !updatedUsers.includes(user.username)
      );

      // Update offline users
      setOfflineUsers(prevOfflineUsers => {
        const updatedOfflineUsers = [...prevOfflineUsers, ...newOfflineUsers];
        return updatedOfflineUsers.filter(user => !updatedUsers.includes(user.username));
      });

      // Update online users
      setOnlineUsers(filteredOnlineUsers);

      // Update the reference of previous online users
      previousOnlineUsers.current = filteredOnlineUsers;
    });

    return () => {
      newSocket.close();
      socketInitialized.current = false;
    };
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://172.20.10.8:3001/api/v1/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        const userData = await fetchUserData(data.user.username);
        setCurrentUser({
          name: userData.username,
          nickname: userData.nickname || userData.username,
          avatar: userData.profilePicture || 'https://via.placeholder.com/50',
          status: 'online',
          isAdmin: userData.isAdmin
        });
        setIsLoggedIn(true);
        initializeSocket(data.user.username);
      } else {
        alert('Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Error during login:', error);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://172.20.10.8:3001/api/v1/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: registerUsername, password: registerPassword, inviteKey }),
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        alert('Registration successful. Please log in.');
        setIsRegistering(false);
      } else {
        alert('Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Error during registration:', error);
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('http://172.20.10.8:3001/api/v1/logout', {
        method: 'GET',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setIsLoggedIn(false);
        setCurrentUser(null);
        if (socket) {
          socket.disconnect();
        }
        setSocket(null);
        socketInitialized.current = false;
      } else {
        console.error('Logout failed:', data.message);
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const displayLocalSystemMessage = (message) => {
    if (currentUser) {
      const systemMessageData = {
        id: new Date().toISOString(),
        message: message,
        username: 'System',
        nickname: 'System',
        profilePicture: <FaInfoCircle />, // Using FaInfoCircle icon as the profile picture
        isSystem: true,
        isCurrentUser: true,
        timestamp: new Date().toISOString()
      };

      console.log('Displaying local system message:', systemMessageData);
      
      // Add the system message to the local messages state
      setMessages(prevMessages => [...prevMessages, systemMessageData]);
    } else {
      console.error('Cannot display system message: User not initialized');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('handleSubmit called');
    console.log('Current input message:', inputMessage);
    console.log('Socket status:', socket ? 'initialized' : 'not initialized');
    console.log('Current user:', currentUser);

    if(inputMessage.startsWith("/user create")){
      if(currentUser.isAdmin) {
        const username = inputMessage.split(" ")[2];
        const password = inputMessage.split(" ")[3];

        if(username === "" || password === ""){
          username = Math.random().toString(36).substring(2, 15);
          password = Math.random().toString(36).substring(2, 15);
        }

        const r = await fetch('http://172.20.10.8:3001/api/v1/invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ amount: 1 }),
          credentials: 'include'
        });
        const d = await r.json();

        
        const resp = await fetch('http://172.20.10.8:3001/api/v1/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, password, inviteKey: d.message }),
          credentials: 'include'
        });
        const data = await resp.json();
        if(data.success){
          displayLocalSystemMessage("User created successfully");
        } else {
          displayLocalSystemMessage("User creation failed");
        }
        setInputMessage('');
        return;
      }
    }


    if(inputMessage.startsWith("/invites create")){
      if(currentUser.isAdmin){
        const amount = inputMessage.split(" ")[2];
        console.log(amount);
        const resp = await fetch('http://172.20.10.8:3001/api/v1/invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ amount }),
          credentials: 'include'
        });
        const data = await resp.json();
        displayLocalSystemMessage(data.message);
        setInputMessage('');
        return;
      }
    }

    if(inputMessage.startsWith("/") && !currentUser.isAdmin){
      displayLocalSystemMessage("You do not have permission to use commands");
      return;
    } else if(inputMessage.startsWith("/") && currentUser.isAdmin){
      displayLocalSystemMessage("Invalid Command!");
      return;
    }
    



    if (!socket) {
      console.error('Socket is not initialized');
      return;
    }

    if (!socket.connected) {
      console.error('Socket is not connected');
      return;
    }

    if (inputMessage && currentUser) {
      const messageData = {
        message: inputMessage,
        username: currentUser.name,
        nickname: currentUser.nickname,
        profilePicture: currentUser.avatar,
        isAdmin: currentUser.isAdmin
      };

      console.log('Emitting message:', messageData);
      socket.emit('chat message', messageData, (error) => {
        if (error) {
          console.error('Error sending message:', error);
        } else {
          console.log('Message sent successfully');
          setInputMessage('');
        }
      });
    } else {
      console.log('Message or user data is missing:', { inputMessage, currentUser });
    }
    setInputMessage('');
  };

  const openUserModal = async (username) => {
    try {
      const userData = await fetchUserData(username);
      if (userData) {
        setSelectedUser(userData);
        setModalOpen(true);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const renderUserAvatar = (msg) => {
    if (msg.username === 'System') {
      return (
        <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center">
          <FaInfoCircle className="text-gray-200" />
        </div>
      );
    } else {
      return <img src={msg.profilePicture || 'https://via.placeholder.com/36'} alt="User avatar" className="w-9 h-9 rounded-full mr-3" />;
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      console.log('File selected:', file.name);
      const formData = new FormData();
      formData.append('file', file);
      fetch('http://172.20.10.8:3001/api/v1/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          const messageData = {
            message: '',
            username: currentUser.name,
            nickname: currentUser.nickname,
            profilePicture: currentUser.avatar,
            fileURL: data.fileUrl,
            isImage: file.type.startsWith('image/'),
            isVideo: file.type.startsWith('video/'),
            isSystem: false,
            timestamp: new Date().toISOString(),
            isAdmin: currentUser.isAdmin
          };
          socket.emit('chat message', messageData);
        } else {
          console.error('File upload failed:', data.message);
        }
      })
    }
  };

  const isImageUrl = (url) => {
    return /\.(jpg|jpeg|png|gif)$/i.test(url);
  };

  const isVideoUrl = (url) => {
    return /\.(mp4|webm|ogg)$/i.test(url);
  };

  const renderMessageContent = (msg) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = msg.message.split(urlRegex);

    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        if (isImageUrl(part)) {
          return <img key={index} src={part} alt="Shared image" className="max-w-full h-auto rounded-lg mt-2" style={{maxHeight: '300px'}} />;
        } else if (isVideoUrl(part)) {
          return (
            <div key={index}>
              <video controls className="max-w-full h-auto rounded-lg mt-2" style={{maxHeight: '300px'}}>
                <source src={part} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
              <a href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{part}</a>
            </div>
          );
        } else {
          return <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{part}</a>;
        }
      } else {
        return part;
      }
    });
  };

  const handleProfilePictureUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const response = await fetch('http://172.20.10.8:3001/api/v1/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
          updateProfile(data.fileUrl, newNickname);
        } else {
          console.error('File upload failed:', data.message);
        }
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }
  };

  const updateProfile = async (profilePictureUrl, nickname) => {
    try {
      const response = await fetch('http://172.20.10.8:3001/api/v1/users/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profilePicture: profilePictureUrl,
          nickname: nickname,
          username: currentUser.name
        }),
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setCurrentUser(prevUser => ({
          ...prevUser,
          avatar: profilePictureUrl,
          nickname: nickname || prevUser.nickname
        }));
        setEditProfileOpen(false);
      } else {
        console.error('Profile update failed:', data.message);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 px-4">
        <form onSubmit={isRegistering ? handleRegister : handleLogin} className="bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-2xl font-bold mb-6 text-gray-200">{isRegistering ? 'Register' : 'Login'}</h2>
          <div className="mb-4">
            <label htmlFor="username" className="block text-gray-300 mb-2">Username</label>
            <div className="relative">
              <FaUser className="absolute left-3 top-3 text-gray-500" />
              <input
                type="text"
                id="username"
                value={isRegistering ? registerUsername : loginUsername}
                onChange={(e) => isRegistering ? setRegisterUsername(e.target.value) : setLoginUsername(e.target.value)}
                className="w-full p-2 pl-10 rounded bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>
          </div>
          <div className="mb-6">
            <label htmlFor="password" className="block text-gray-300 mb-2">Password</label>
            <div className="relative">
              <FaLock className="absolute left-3 top-3 text-gray-500" />
              <input
                type="password"
                id="password"
                value={isRegistering ? registerPassword : loginPassword}
                onChange={(e) => isRegistering ? setRegisterPassword(e.target.value) : setLoginPassword(e.target.value)}
                className="w-full p-2 pl-10 rounded bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>
          </div>
          {isRegistering && (
            <div className="mb-6">
              <label htmlFor="inviteKey" className="block text-gray-300 mb-2">Invite Key</label>
              <div className="relative">
                <FaKey className="absolute left-3 top-3 text-gray-500" />
                <input
                  type="text"
                  id="inviteKey"
                  value={inviteKey}
                  onChange={(e) => setInviteKey(e.target.value)}
                  className="w-full p-2 pl-10 rounded bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
            </div>
          )}
          <button type="submit" className="w-full bg-purple-600 text-white p-2 rounded hover:bg-purple-700 transition duration-200">
            {isRegistering ? 'Register' : 'Login'}
          </button>
          <button
            type="button"
            onClick={() => setIsRegistering(!isRegistering)}
            className="w-full mt-4 bg-gray-700 text-white p-2 rounded hover:bg-gray-600 transition duration-200"
          >
            {isRegistering ? 'Switch to Login' : 'Switch to Register'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-200 md:flex-row">
      {/* User info sidebar */}
      <div className={`fixed inset-y-0 left-0 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition duration-200 ease-in-out z-30 w-64 bg-gray-800 shadow-lg md:relative md:translate-x-0 md:w-1/4`}>
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-purple-400">User Info</h2>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-2 rounded-md bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <FaTimes className="w-6 h-6 text-gray-400" />
          </button>
        </div>
        <div className="p-6 relative">
          <img src={currentUser?.avatar} alt="User avatar" className="w-20 h-20 rounded-full mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-center text-gray-200">
            {currentUser?.nickname}
            {currentUser?.isAdmin && (
              <FaShieldAlt className="inline-block ml-2 text-red-500" title="Admin" />
            )}
          </h2>
          <p className="text-center text-green-400">{currentUser?.status}</p>
          <button
            onClick={() => setEditProfileOpen(true)}
            className="absolute top-2 right-2 p-2 rounded-full bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <FaEllipsisV className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="mt-6">
          <h2 className="text-xl font-semibold text-center mb-4 text-gray-200">Users</h2>
          <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
            <h3 className="text-sm font-semibold uppercase px-4 py-2 text-gray-500">Online — {onlineUsers.length}</h3>
            <ul>
              {onlineUsers.map((user) => (
                <li
                  key={user.username}
                  className={`cursor-pointer hover:bg-gray-700 px-4 py-2 flex items-center ${
                    user.username === currentChat ? 'bg-gray-700' : ''
                  }`}
                  onClick={() => openUserModal(user.username)}
                >
                  <img src={user.profilePicture} alt="User avatar" className="w-8 h-8 rounded-full mr-2" />
                  <FaCircle className="text-green-500 mr-2" />
                  <span className={`${user.isAdmin ? 'text-red-500' : 'text-gray-300'}`}>
                    {user.nickname}
                    {user.isAdmin && (
                      <FaShieldAlt className="inline-block ml-2 text-red-500" title="Admin" />
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <h3 className="text-sm font-semibold uppercase px-4 py-2 text-gray-500 mt-4">Offline — {offlineUsers.length}</h3>
            <ul>
              {offlineUsers.map((user) => (
                <li
                  key={user.username}
                  className={`cursor-pointer hover:bg-gray-700 px-4 py-2 flex items-center ${
                    user.username === currentChat ? 'bg-gray-700' : ''
                  }`}
                  onClick={() => openUserModal(user.username)}
                >
                  <img src={user.profilePicture || 'https://via.placeholder.com/36'} alt="User avatar" className="w-8 h-8 rounded-full mr-2" />
                  <FaCircle className="text-gray-500 mr-2" />
                  <span className={`${user.isAdmin ? 'text-red-500' : 'text-gray-400'}`}>
                    {user.nickname}
                    {user.isAdmin && (
                      <FaShieldAlt className="inline-block ml-2 text-red-500" title="Admin" />
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white transition duration-200"
          >
            <FaSignOutAlt className="mr-2" />
            Log Out
          </button>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col md:w-3/4">
        <header className="bg-gray-800 shadow-md p-4 flex items-center fixed top-0 left-0 right-0 z-10">
          {/* Toggle sidebar button */}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 rounded-md bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 mr-4"
          >
            <FaBars className="w-6 h-6 text-gray-400" />
          </button>
          <h1 className="text-xl font-semibold text-gray-200">{currentChat}</h1>
        </header>
        <div className="flex-1 overflow-y-auto p-4 bg-gray-800 mt-16 mb-20">
          {messages.map((msg, index) => (
            <div key={index} className="mb-4 flex items-start">
              {renderUserAvatar(msg)}
              <div className="flex-1 ml-3">
                <div className="flex items-baseline">
                  <span className={`font-semibold mr-2 ${msg.username === 'System' ? 'text-purple-400' : msg.isAdmin ? 'text-red-500' : 'text-purple-300'}`}>
                    {msg.nickname || msg.username}
                    {msg.username === 'System' && (
                      <FaInfoCircle className="inline-block ml-1 text-purple-400" />
                    )}
                    {msg.isAdmin && (
                      <FaShieldAlt className="inline-block ml-1 text-red-500" title="Admin" />
                    )}
                  </span>
                  <span className="text-xs text-gray-500">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                {msg.isImage ? (
                  <img src={msg.fileURL} alt="Uploaded image" className="max-w-full h-auto rounded-lg mt-2" style={{maxHeight: '300px'}} />
                ) : msg.isVideo ? (
                  <video controls className="max-w-full h-auto rounded-lg mt-2" style={{maxHeight: '300px'}}>
                    <source src={msg.fileURL} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <p className="text-gray-300 break-words">{renderMessageContent(msg)}</p>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSubmit} className="p-4 bg-gray-800 border-t border-gray-700 flex items-center fixed bottom-0 left-0 right-0 md:left-1/4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,video/*,application/*"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current.click()}
            className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 mr-2"
          >
            <FaPaperclip className="w-6 h-6 text-gray-400" />
          </button>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={`Message ${currentChat}`}
            className="flex-grow p-2 rounded-full bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-200 mr-2"
          />
          <button
            type="submit"
            className="p-2 rounded-full bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <FaPaperPlane className="w-6 h-6 text-white" />
          </button>
        </form>
      </div>

      {/* User Info Modal */}
      {modalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg overflow-hidden w-full max-w-sm">
            <div className="relative">
              <div className="h-24 bg-purple-600"></div>
              <img src={selectedUser.profilePicture} alt="User avatar" className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-24 h-24 rounded-full border-4 border-gray-800" />
            </div>
            <div className="pt-16 pb-8 px-6">
              <h2 className="text-2xl font-bold text-center mb-2 text-gray-200">
                {selectedUser.nickname || selectedUser.username}
                {selectedUser.isAdmin && (
                  <FaShieldAlt className="inline-block ml-2 text-red-500" title="Admin" />
                )}
              </h2>
              <h2 className="text-2xl font-bold text-center mb-2 text-gray-200">{selectedUser.nickname || selectedUser.username}</h2>
              <p className="text-gray-400 text-center mb-4">@{selectedUser.username}</p>
              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-lg font-semibold mb-2 text-gray-200">About Me</h3>
                <p className="text-gray-400">No additional information available.</p>
              </div>
            </div>
            <div className="bg-gray-700 px-6 py-4 flex justify-end">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md text-white transition duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editProfileOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg overflow-hidden w-full max-w-sm">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-200">Edit Profile</h2>
              <div className="mb-4">
                <label className="block text-gray-300 mb-2">Profile Picture</label>
                <input
                  type="file"
                  ref={profilePictureInputRef}
                  onChange={handleProfilePictureUpload}
                  className="hidden"
                  accept="image/*"
                />
                <button
                  onClick={() => profilePictureInputRef.current.click()}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md text-white transition duration-200"
                >
                  Upload New Picture
                </button>
              </div>
              <div className="mb-4">
                <label htmlFor="nickname" className="block text-gray-300 mb-2">Nickname</label>
                <input
                  type="text"
                  id="nickname"
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  className="w-full p-2 rounded bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder={currentUser.nickname || currentUser.username}
                />
              </div>
            </div>
            <div className="bg-gray-700 px-6 py-4 flex justify-end">
              <button
                onClick={() => setEditProfileOpen(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md text-white transition duration-200 mr-2"
              >
                Cancel
              </button>
              <button
                onClick={() => updateProfile(currentUser.avatar, newNickname)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md text-white transition duration-200"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
