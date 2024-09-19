import './App.css';

import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { FaUser, FaLock, FaPaperPlane, FaBars, FaTimes, FaCircle, FaInfoCircle, FaMoon, FaSun, FaPaperclip, FaEllipsisV, FaSignOutAlt } from 'react-icons/fa';

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
            avatar: userData.profilePicture || 'https://via.placeholder.com/50',
            status: 'online'
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
      setOfflineUsers(users);
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
          profilePicture: userData.profilePicture || 'https://via.placeholder.com/36'
        } : null;
      }));
      setOnlineUsers(onlineUsersData.filter(user => user !== null));
      setOfflineUsers(prev => prev.filter(user => !updatedUsers.includes(user.username)));
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
          avatar: userData.profilePicture || 'https://via.placeholder.com/50',
          status: 'online'
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

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('handleSubmit called');
    console.log('Current input message:', inputMessage);
    console.log('Socket status:', socket ? 'initialized' : 'not initialized');
    console.log('Current user:', currentUser);

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
        nickname: currentUser.name,
        profilePicture: currentUser.avatar,
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
      // Handle file upload logic here
      console.log('File selected:', file.name);
      // send the file to the api/v1/upload endpoint
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
            nickname: currentUser.name,
            profilePicture: currentUser.avatar,
            fileURL: data.fileUrl,
            isImage: true,
            isSystem: false,
            timestamp: new Date().toISOString()
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

  const renderMessageContent = (msg) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = msg.message.split(urlRegex);

    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        if (isImageUrl(part)) {
          return <img key={index} src={part} alt="Shared image" className="max-w-full h-auto rounded-lg mt-2" style={{maxHeight: '300px'}} />;
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
          name: nickname || prevUser.name
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
        <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-2xl font-bold mb-6 text-gray-200">Login</h2>
          <div className="mb-4">
            <label htmlFor="username" className="block text-gray-300 mb-2">Username</label>
            <div className="relative">
              <FaUser className="absolute left-3 top-3 text-gray-500" />
              <input
                type="text"
                id="username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
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
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full p-2 pl-10 rounded bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-purple-600 text-white p-2 rounded hover:bg-purple-700 transition duration-200">
            Login
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
          <h2 className="text-xl font-semibold text-center text-gray-200">{currentUser?.name}</h2>
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
                  <span className="text-gray-300">{user.username}</span>
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
                  <span className="text-gray-400">{user.username}</span>
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
                  <span className={`font-semibold mr-2 ${msg.username === 'System' ? 'text-purple-400' : 'text-purple-300'}`}>
                    {msg.nickname || msg.username}
                    {msg.username === 'System' && (
                      <FaInfoCircle className="inline-block ml-1 text-purple-400" />
                    )}
                  </span>
                  <span className="text-xs text-gray-500">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                {msg.isImage ? (
                  <img src={msg.fileURL} alt="Uploaded image" className="max-w-full h-auto rounded-lg mt-2" style={{maxHeight: '300px'}} />
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
            accept="image/*,application/*"
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
                  placeholder="Enter new nickname"
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
