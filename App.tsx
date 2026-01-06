import React, { useState, useEffect, useRef } from 'react';
import { SharedItem, ContentType, DeviceProfile, Notification } from './types';
import { FeedItemCard } from './components/FeedItemCard';
import { NotificationToast } from './components/NotificationToast';
import {
  sharedItemsRef,
  devicesRef,
  addSharedItem as firebaseAddItem,
  registerDevice,
  cleanupStaleDevices,
  clearAllSharedItems,
  deleteSharedItem,
  onValue
} from './services/firebase';
import { initKakao, kakaoLogin, kakaoLogout, getStoredUser, KakaoUser } from './services/kakao';
import {
  Wifi,
  Send,
  Image as ImageIcon,
  FileText,
  Film,
  Smartphone,
  Monitor,
  Share2,
  Loader2,
  Laptop,
  Menu,
  X,
  Zap,
  MessageCircle,
  RefreshCw,
  LogIn,
  LogOut,
  User,
  ChevronDown,
  ChevronUp,
  Users,
  Copy,
  Trash2,
  Download,
  Clock,
  Check
} from 'lucide-react';

// 기기 ID 생성 (브라우저별 고유)
const getDeviceId = () => {
  let deviceId = localStorage.getItem('syncflow_device_id');
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('syncflow_device_id', deviceId);
  }
  return deviceId;
};

// 기기 타입 감지
const detectDeviceType = (): 'mobile' | 'laptop' | 'desktop' => {
  const ua = navigator.userAgent;
  if (/Mobile|Android|iPhone|iPad/.test(ua)) return 'mobile';
  if (/Mac|MacBook/.test(ua)) return 'laptop';
  return 'desktop';
};

// 기기 이름 생성
const getDeviceName = () => {
  let name = localStorage.getItem('syncflow_device_name');
  if (!name) {
    const type = detectDeviceType();
    const names = {
      mobile: ['내 스마트폰', '모바일 기기', '휴대폰'],
      laptop: ['내 노트북', '맥북', '랩탑'],
      desktop: ['내 데스크탑', '컴퓨터', 'PC']
    };
    name = names[type][Math.floor(Math.random() * names[type].length)];
    localStorage.setItem('syncflow_device_name', name);
  }
  return name;
};

const App: React.FC = () => {
  const deviceId = getDeviceId();
  const deviceType = detectDeviceType();
  const deviceName = getDeviceName();

  const [currentDevice] = useState<DeviceProfile>({
    id: deviceId,
    name: deviceName,
    type: deviceType
  });
  const [availableDevices, setAvailableDevices] = useState<DeviceProfile[]>([]);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [sharedItems, setSharedItems] = useState<SharedItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [textInput, setTextInput] = useState('');
  const [activeTab, setActiveTab] = useState<ContentType>(ContentType.TEXT);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUserListOpen, setIsUserListOpen] = useState(false);
  const [kakaoUser, setKakaoUser] = useState<KakaoUser | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<SharedItem | null>(null);
  const [copiedInPanel, setCopiedInPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userListRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const processedIds = useRef<Set<string>>(new Set());

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userListRef.current && !userListRef.current.contains(event.target as Node)) {
        setIsUserListOpen(false);
      }
    };

    if (isUserListOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserListOpen]);

  // 카카오 SDK 초기화
  useEffect(() => {
    initKakao();
    const storedUser = getStoredUser();
    if (storedUser) {
      setKakaoUser(storedUser);
    }
  }, []);

  // Firebase 연결 및 데이터 구독
  useEffect(() => {
    setIsConnecting(true);

    // 오래된 기기 정리
    cleanupStaleDevices();

    // 공유 아이템 구독
    const unsubscribeItems = onValue(sharedItemsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const items: SharedItem[] = Object.entries(data)
          .map(([key, value]: [string, any]) => ({
            id: key,
            type: value.type,
            content: value.content,
            fileName: value.fileName,
            sender: value.sender,
            senderImage: value.senderImage,
            senderId: value.senderId,
            timestamp: value.timestamp || value.createdAt,
            isProcessing: false
          }))
          .sort((a, b) => a.timestamp - b.timestamp);

        setSharedItems(items);

        // 처리된 메시지 ID 추적
        items.forEach(item => {
          processedIds.current.add(item.id);
        });
      } else {
        setSharedItems([]);
      }
      setIsConnecting(false);
      setIsConnected(true);
    }, (error) => {
      console.error('Firebase 연결 오류:', error);
      setIsConnecting(false);
      setIsConnected(false);
      addNotification('연결 실패', 'error');
    });

    // 연결된 기기 목록 구독
    const unsubscribeDevices = onValue(devicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const devices: DeviceProfile[] = Object.values(data);
        setAvailableDevices(devices);
      } else {
        setAvailableDevices([]);
      }
    });

    // 정리
    return () => {
      unsubscribeItems();
      unsubscribeDevices();
    };
  }, []);

  // 카카오 로그인 시 사용자 등록
  useEffect(() => {
    if (kakaoUser) {
      const cleanupUser = registerDevice(String(kakaoUser.id), {
        id: String(kakaoUser.id),
        name: kakaoUser.nickname,
        type: 'user',
        profileImage: kakaoUser.profileImage
      });

      return () => {
        cleanupUser();
      };
    }
  }, [kakaoUser]);

  // 새 메시지 시 하단으로 스크롤
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [sharedItems]);

  // 선택된 메시지가 삭제되면 패널 닫기
  useEffect(() => {
    if (selectedMessage && !sharedItems.find(item => item.id === selectedMessage.id)) {
      setSelectedMessage(null);
    }
  }, [sharedItems, selectedMessage]);

  const addNotification = (message: string, type: 'success' | 'info' | 'error') => {
    const id = Date.now().toString() + Math.random();
    setNotifications(prev => [...prev, { id, message, type }]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClearAll = async () => {
    const password = prompt('비밀번호를 입력하세요:');
    if (password === '1004') {
      try {
        await clearAllSharedItems();
        addNotification('모든 내용이 삭제되었습니다', 'success');
      } catch (err) {
        addNotification('삭제 실패', 'error');
      }
    } else if (password !== null) {
      addNotification('비밀번호가 틀렸습니다', 'error');
    }
  };

  // 패널에서 메시지 복사
  const handlePanelCopy = async () => {
    if (!selectedMessage) return;
    try {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = selectedMessage.content;
      const decodedText = textarea.value;
      await navigator.clipboard.writeText(decodedText);
      setCopiedInPanel(true);
      setTimeout(() => setCopiedInPanel(false), 2000);
    } catch (err) {
      addNotification('복사 실패', 'error');
    }
  };

  // 패널에서 메시지 삭제
  const handlePanelDelete = async () => {
    if (!selectedMessage) return;
    const confirm = window.confirm('이 메시지를 삭제하시겠습니까?');
    if (confirm) {
      try {
        await deleteSharedItem(selectedMessage.id);
        setSelectedMessage(null);
        addNotification('메시지가 삭제되었습니다', 'success');
      } catch (err) {
        addNotification('삭제 실패', 'error');
      }
    }
  };

  // 패널에서 미디어 다운로드
  const handlePanelDownload = () => {
    if (!selectedMessage) return;
    const link = document.createElement('a');
    link.href = selectedMessage.content;
    if (selectedMessage.fileName) {
      link.download = selectedMessage.fileName;
    } else {
      const ext = selectedMessage.type === ContentType.IMAGE ? 'png' : 'mp4';
      link.download = `tbchat_${selectedMessage.id}.${ext}`;
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 시간 포맷
  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleKakaoLogin = async () => {
    try {
      const user = await kakaoLogin();
      if (user) {
        setKakaoUser(user);
        addNotification(`${user.nickname}님 환영합니다!`, 'success');
      }
    } catch (err) {
      addNotification('로그인에 실패했습니다', 'error');
    }
  };

  const handleKakaoLogout = async () => {
    try {
      await kakaoLogout();
      setKakaoUser(null);
      addNotification('로그아웃 되었습니다', 'info');
    } catch (err) {
      addNotification('로그아웃에 실패했습니다', 'error');
    }
  };

  const handleSendText = async () => {
    if (!textInput.trim()) return;

    const newItem = {
      type: ContentType.TEXT,
      content: textInput,
      sender: kakaoUser?.nickname || currentDevice.name,
      senderImage: kakaoUser?.profileImage || null,
      senderId: kakaoUser?.id || null,
      timestamp: Date.now()
    };

    try {
      await firebaseAddItem(newItem);
      setTextInput('');
    } catch (error) {
      console.error('전송 실패:', error);
      addNotification('전송 실패', 'error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video');
    const isImage = file.type.startsWith('image');

    if (!isVideo && !isImage) {
      addNotification('이미지와 비디오만 지원됩니다.', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      addNotification('파일 크기는 10MB 이하만 지원됩니다.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;

      const newItem = {
        type: isVideo ? ContentType.VIDEO : ContentType.IMAGE,
        content: content,
        fileName: file.name,
        sender: kakaoUser?.nickname || currentDevice.name,
        senderImage: kakaoUser?.profileImage || null,
        senderId: kakaoUser?.id || null,
        timestamp: Date.now()
      };

      try {
        await firebaseAddItem(newItem);
      } catch (error) {
        console.error('전송 실패:', error);
        addNotification('전송 실패', 'error');
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 로그인 안 된 경우 인트로 화면 표시
  if (!kakaoUser) {
    return (
      <div className="min-h-screen memphis-bg flex items-center justify-center p-4">
        <NotificationToast notifications={notifications} removeNotification={removeNotification} />
        <div className="bg-white p-8 md:p-12 border-4 border-gray-900 shadow-[8px_8px_0px_#1a1a2e] max-w-md w-full text-center">
          <img src="/logo.png" alt="TB CHAT" className="w-24 h-24 mx-auto mb-6 rounded-full border-4 border-gray-900" />
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">TB CHAT</h1>
          <p className="text-gray-600 font-medium mb-8">실시간 텍스트, 이미지, 동영상 공유</p>

          <button
            onClick={handleKakaoLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#FEE500] hover:bg-[#FADA0A] text-gray-900 font-bold text-lg border-3 border-gray-900 shadow-[4px_4px_0px_#1a1a2e] hover:shadow-[6px_6px_0px_#1a1a2e] hover:-translate-y-0.5 transition-all"
            style={{border: '3px solid #1a1a2e', boxShadow: '4px 4px 0px #1a1a2e'}}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 3C6.48 3 2 6.48 2 10.5C2 13.08 3.72 15.33 6.36 16.59L5.38 20.31C5.31 20.56 5.6 20.76 5.82 20.62L10.15 17.82C10.75 17.9 11.37 17.95 12 17.95C17.52 17.95 22 14.47 22 10.45C22 6.48 17.52 3 12 3Z" fill="#3C1E1E"/>
            </svg>
            카카오로 시작하기
          </button>

          <p className="text-xs text-gray-500 mt-6">
            로그인하면 서비스 이용약관에 동의하게 됩니다
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen memphis-bg text-gray-900 flex flex-col md:flex-row font-sans">
      <NotificationToast notifications={notifications} removeNotification={removeNotification} />

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-80 bg-[#FFE66D] border-r-4 border-gray-900 p-6 flex flex-col h-screen
        transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="TB CHAT" className="w-12 h-12 rounded-full border-2 border-gray-900" />
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">TB CHAT</h1>
              <p className="text-xs text-gray-700 font-medium">실시간 공유</p>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-2 text-gray-900 hover:bg-[#FF6B6B] hover:text-white transition-colors border-2 border-gray-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User List - Compact with Dropdown */}
        <div className="mb-6" ref={userListRef}>
          <button
            onClick={() => setIsUserListOpen(!isUserListOpen)}
            className="w-full bg-white p-3 border-3 border-gray-900 shadow-[4px_4px_0px_#1a1a2e] flex items-center justify-between hover:bg-gray-50 transition-colors"
            style={{border: '3px solid #1a1a2e', boxShadow: '4px 4px 0px #1a1a2e'}}
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-[#4ECDC4]" />
              <span className="text-sm font-bold">접속 중인 사용자</span>
              <span className="px-2 py-0.5 bg-[#4ECDC4] text-xs font-bold border-2 border-gray-900">{availableDevices.length}</span>
            </div>
            {isUserListOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          {isUserListOpen && (
            <div className="mt-2 space-y-2">
              {availableDevices.length > 0 ? (
                availableDevices.map(user => (
                  <div
                    key={user.id}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all border-2 border-gray-900 ${
                      kakaoUser && String(kakaoUser.id) === user.id
                        ? 'bg-[#4ECDC4] shadow-[3px_3px_0px_#1a1a2e]'
                        : 'bg-white hover:bg-gray-100'
                    }`}
                    style={kakaoUser && String(kakaoUser.id) === user.id ? {boxShadow: '3px 3px 0px #1a1a2e'} : {}}
                  >
                    {user.profileImage ? (
                      <img src={user.profileImage} alt={user.name} className="w-8 h-8 rounded-full border-2 border-gray-900 object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#FFE66D] border-2 border-gray-900 flex items-center justify-center">
                        <span className="text-xs font-bold">{user.name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <div className="font-bold">{user.name}</div>
                      {kakaoUser && String(kakaoUser.id) === user.id && <div className="text-[10px] font-medium">나</div>}
                    </div>
                    <div className="w-2 h-2 bg-[#4ECDC4] rounded-full border border-gray-900"></div>
                  </div>
                ))
              ) : (
                 <div className="text-center py-4 text-gray-600 text-xs font-medium bg-white border-2 border-gray-900 border-dashed">
                   접속 중인 사용자가 없습니다
                 </div>
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-auto pt-4 border-t-2 border-gray-900">
          <div className="text-xs text-gray-700 leading-relaxed font-medium">
            <strong className="text-gray-900">사용 방법:</strong><br/>
            다른 기기에서 같은 URL을 열면<br/>
            자동으로 실시간 동기화됩니다.
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b-4 border-gray-900 bg-[#4ECDC4] flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-gray-900 hover:bg-[#FF6B6B] hover:text-white transition-colors border-2 border-gray-900 bg-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            {kakaoUser && (
              <span className="text-gray-900 font-bold text-sm flex items-center gap-2 bg-white px-3 py-1 border-2 border-gray-900">
                {kakaoUser.profileImage ? (
                  <img src={kakaoUser.profileImage} alt="" className="w-5 h-5 rounded-full" />
                ) : (
                  <User className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{kakaoUser.nickname}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleKakaoLogout}
              className="p-2 text-gray-900 hover:bg-[#FF6B6B] hover:text-white transition-colors border-2 border-gray-900 bg-white"
              title="로그아웃"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <button
              onClick={handleClearAll}
              className="p-2 text-gray-900 hover:bg-[#FF6B6B] hover:text-white transition-colors border-2 border-gray-900 bg-white"
              title="전체 삭제"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Feed Area */}
        <div ref={feedRef} className="flex-1 overflow-y-auto p-4 pb-48 md:pb-6 flex flex-col justify-end">
          {sharedItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="bg-white p-8 border-3 border-gray-900 shadow-[6px_6px_0px_#1a1a2e] text-center" style={{border: '3px solid #1a1a2e', boxShadow: '6px 6px 0px #1a1a2e'}}>
                <div className="w-20 h-20 bg-[#FFE66D] border-3 border-gray-900 flex items-center justify-center mx-auto mb-4" style={{border: '3px solid #1a1a2e'}}>
                  <MessageCircle className="w-10 h-10 text-gray-900" />
                </div>
                <p className="text-xl font-black text-gray-900 mb-2">공유된 항목이 없습니다</p>
                <p className="text-sm text-gray-600 font-medium">텍스트, 이미지, 동영상을 공유해보세요!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {sharedItems.map(item => (
                <FeedItemCard
                  key={item.id}
                  item={item}
                  currentUserId={kakaoUser?.id}
                  currentUserName={kakaoUser?.nickname}
                  onSelect={() => setSelectedMessage(item)}
                  isSelected={selectedMessage?.id === item.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="fixed md:static bottom-0 left-0 right-0 p-4 md:p-6 bg-[#FF6B6B] border-t-4 border-gray-900 shrink-0 z-30">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="flex gap-2">
              <button
                onClick={() => setActiveTab(ContentType.TEXT)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-bold transition-all border-2 border-gray-900 ${
                  activeTab === ContentType.TEXT
                    ? 'bg-[#FFE66D] shadow-[3px_3px_0px_#1a1a2e] -translate-y-0.5'
                    : 'bg-white hover:bg-gray-100'
                }`}
                style={activeTab === ContentType.TEXT ? {boxShadow: '3px 3px 0px #1a1a2e'} : {}}
              >
                <FileText className="w-4 h-4" /> 텍스트
              </button>
              <button
                onClick={() => setActiveTab(ContentType.IMAGE)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-bold transition-all border-2 border-gray-900 ${
                  activeTab === ContentType.IMAGE
                    ? 'bg-[#4ECDC4] shadow-[3px_3px_0px_#1a1a2e] -translate-y-0.5'
                    : 'bg-white hover:bg-gray-100'
                }`}
                style={activeTab === ContentType.IMAGE ? {boxShadow: '3px 3px 0px #1a1a2e'} : {}}
              >
                <ImageIcon className="w-4 h-4" /> 사진
              </button>
              <button
                onClick={() => setActiveTab(ContentType.VIDEO)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-bold transition-all border-2 border-gray-900 ${
                  activeTab === ContentType.VIDEO
                    ? 'bg-[#FF6B6B] text-white shadow-[3px_3px_0px_#1a1a2e] -translate-y-0.5'
                    : 'bg-white hover:bg-gray-100'
                }`}
                style={activeTab === ContentType.VIDEO ? {boxShadow: '3px 3px 0px #1a1a2e'} : {}}
              >
                <Film className="w-4 h-4" /> 동영상
              </button>
              </div>
            </div>

            <div className="relative">
              {activeTab === ContentType.TEXT ? (
                <div className="relative">
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="공유할 텍스트를 입력하세요..."
                    className="w-full bg-white text-gray-900 placeholder-gray-500 p-4 pr-14 outline-none border-3 border-gray-900 shadow-[4px_4px_0px_#1a1a2e] transition-all resize-none h-24 font-medium focus:shadow-[6px_6px_0px_#1a1a2e]"
                    style={{border: '3px solid #1a1a2e', boxShadow: '4px 4px 0px #1a1a2e'}}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        handleSendText();
                      }
                    }}
                  />
                  <button
                    onClick={handleSendText}
                    disabled={!isConnected}
                    className="absolute right-3 bottom-3 p-2 bg-[#4ECDC4] hover:bg-[#FFE66D] disabled:bg-gray-300 text-gray-900 border-2 border-gray-900 transition-all font-bold"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex justify-center">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full max-w-xs h-28 border-3 border-dashed border-gray-900 flex flex-col items-center justify-center bg-white text-gray-700 hover:bg-[#FFE66D] transition-all cursor-pointer rounded-lg"
                    style={{borderWidth: '3px'}}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept={activeTab === ContentType.IMAGE ? "image/*" : "video/*"}
                      onChange={handleFileUpload}
                    />
                    <div className="p-3 bg-[#4ECDC4] border-2 border-gray-900 mb-2 rounded">
                      {activeTab === ContentType.IMAGE ? <ImageIcon className="w-5 h-5" /> : <Film className="w-5 h-5" />}
                    </div>
                    <span className="text-sm font-bold">클릭하여 {activeTab === ContentType.IMAGE ? '사진' : '동영상'} 선택</span>
                    <span className="text-xs text-gray-500 mt-1 font-medium">최대 10MB</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Right Panel - Message Detail */}
      {selectedMessage && (
        <aside className="hidden md:flex w-80 bg-white border-l-4 border-gray-900 flex-col h-screen shrink-0">
          {/* Panel Header */}
          <div className="p-4 border-b-3 border-gray-900 flex items-center justify-between bg-[#4ECDC4]" style={{borderBottom: '3px solid #1a1a2e'}}>
            <h3 className="font-bold text-gray-900">메시지 상세</h3>
            <button
              onClick={() => setSelectedMessage(null)}
              className="p-1.5 hover:bg-white/50 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sender Info */}
          <div className="p-4 border-b-2 border-gray-200">
            <div className="flex items-center gap-3">
              {selectedMessage.senderImage ? (
                <img src={selectedMessage.senderImage} alt="" className="w-12 h-12 rounded-full border-2 border-gray-900" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#FFE66D] border-2 border-gray-900 flex items-center justify-center">
                  <span className="text-lg font-bold">{selectedMessage.sender.charAt(0)}</span>
                </div>
              )}
              <div>
                <div className="font-bold text-gray-900">{selectedMessage.sender}</div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDateTime(selectedMessage.timestamp)}
                </div>
              </div>
            </div>
          </div>

          {/* Content Preview */}
          <div className="flex-1 overflow-y-auto p-4">
            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">내용</label>
            {selectedMessage.type === ContentType.TEXT ? (
              <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{selectedMessage.content}</p>
              </div>
            ) : selectedMessage.type === ContentType.IMAGE ? (
              <img src={selectedMessage.content} alt="Preview" className="w-full rounded-lg border-2 border-gray-900" />
            ) : (
              <video src={selectedMessage.content} controls className="w-full rounded-lg border-2 border-gray-900" />
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t-3 border-gray-900 space-y-2" style={{borderTop: '3px solid #1a1a2e'}}>
            {selectedMessage.type === ContentType.TEXT ? (
              <button
                onClick={handlePanelCopy}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold transition-all border-2 border-gray-900 ${copiedInPanel ? 'bg-[#4ECDC4]' : 'bg-white hover:bg-[#FFE66D]'}`}
              >
                {copiedInPanel ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedInPanel ? '복사됨!' : '메시지 복사'}
              </button>
            ) : (
              <button
                onClick={handlePanelDownload}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold transition-all border-2 border-gray-900 bg-white hover:bg-[#FFE66D]"
              >
                <Download className="w-4 h-4" />
                다운로드
              </button>
            )}
            <button
              onClick={handlePanelDelete}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold transition-all border-2 border-gray-900 bg-white hover:bg-[#FF6B6B] hover:text-white"
            >
              <Trash2 className="w-4 h-4" />
              메시지 삭제
            </button>
          </div>
        </aside>
      )}
    </div>
  );
};

export default App;
