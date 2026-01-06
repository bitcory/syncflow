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
  User
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
  const [kakaoUser, setKakaoUser] = useState<KakaoUser | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processedIds = useRef<Set<string>>(new Set());

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

    // 기기 등록 (cleanup 함수 반환)
    const cleanupDevice = registerDevice(deviceId, {
      id: deviceId,
      name: deviceName,
      type: deviceType
    });

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
            timestamp: value.timestamp || value.createdAt,
            isProcessing: false
          }))
          .sort((a, b) => b.timestamp - a.timestamp);

        setSharedItems(items);

        // 새 메시지 알림 (다른 기기에서 온 경우)
        items.forEach(item => {
          if (!processedIds.current.has(item.id) && item.sender !== deviceName) {
            addNotification(`${item.sender}에서 새 메시지 도착`, 'info');
            processedIds.current.add(item.id);
          }
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
      cleanupDevice();
    };
  }, []);

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

        {/* Connection Status */}
        <div className="bg-white p-4 border-3 border-gray-900 shadow-[4px_4px_0px_#1a1a2e] mb-6" style={{border: '3px solid #1a1a2e', boxShadow: '4px 4px 0px #1a1a2e'}}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-700 uppercase">연결 상태</span>
            <div className={`flex items-center gap-1.5 px-2 py-1 ${isConnecting ? 'bg-[#FFE66D]' : (isConnected ? 'bg-[#4ECDC4]' : 'bg-[#FF6B6B]')} border-2 border-gray-900`}>
              {isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              <span className="text-xs font-bold">
                {isConnecting ? '연결 중...' : (isConnected ? '연결됨' : '연결 안됨')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Wifi className="w-4 h-4 text-[#4ECDC4]" />
            <span className="text-sm text-gray-700 font-medium">어디서든 실시간 동기화</span>
          </div>
        </div>

        {/* Device List */}
        <div className="mb-6 flex-1">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold text-gray-700 uppercase">
              연결된 기기 ({availableDevices.length})
            </label>
          </div>

          <div className="space-y-2">
            {availableDevices.length > 0 ? (
              availableDevices.map(dev => (
                <div
                  key={dev.id}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all border-2 border-gray-900 ${
                    dev.id === deviceId
                      ? 'bg-[#4ECDC4] shadow-[3px_3px_0px_#1a1a2e]'
                      : 'bg-white hover:bg-gray-100'
                  }`}
                  style={dev.id === deviceId ? {boxShadow: '3px 3px 0px #1a1a2e'} : {}}
                >
                  {dev.type === 'mobile' && <Smartphone className="w-4 h-4" />}
                  {dev.type === 'laptop' && <Laptop className="w-4 h-4" />}
                  {dev.type === 'desktop' && <Monitor className="w-4 h-4" />}
                  <div className="flex-1 text-left">
                    <div className="font-bold">{dev.name}</div>
                    {dev.id === deviceId && <div className="text-[10px] font-medium">현재 기기</div>}
                  </div>
                  <div className="w-3 h-3 bg-[#FF6B6B] border-2 border-gray-900 animate-pulse"></div>
                </div>
              ))
            ) : (
               <div className="text-center py-6 text-gray-600 text-xs font-medium bg-white border-2 border-gray-900 border-dashed">
                 연결된 기기가 없습니다
               </div>
            )}
          </div>
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
            <span className="text-gray-900 text-sm hidden sm:inline font-medium">현재 기기:</span>
            <span className="text-gray-900 font-bold text-sm flex items-center gap-2 bg-white px-3 py-1 border-2 border-gray-900">
              {currentDevice.type === 'mobile' ? <Smartphone className="w-3 h-3" /> : (currentDevice.type === 'laptop' ? <Laptop className="w-3 h-3"/> : <Monitor className="w-3 h-3" />)}
              <span className="hidden sm:inline">{currentDevice.name}</span>
              <span className="sm:hidden">{currentDevice.name.split(' ')[0]}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {kakaoUser ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900 hidden sm:flex items-center gap-1 bg-[#FFE66D] px-3 py-1 border-2 border-gray-900">
                  {kakaoUser.profileImage ? (
                    <img src={kakaoUser.profileImage} alt="" className="w-5 h-5 rounded-full" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                  {kakaoUser.nickname}
                </span>
                <button
                  onClick={handleKakaoLogout}
                  className="p-2 text-gray-900 hover:bg-[#4ECDC4] hover:text-white transition-colors border-2 border-gray-900 bg-white"
                  title="로그아웃"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleKakaoLogin}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#FEE500] hover:bg-[#FADA0A] text-gray-900 font-bold text-sm border-2 border-gray-900 transition-colors"
                title="카카오 로그인"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">로그인</span>
              </button>
            )}
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
        <div className="flex-1 overflow-y-auto p-4 pb-48 md:pb-6 space-y-4">
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
            sharedItems.map(item => (
              <FeedItemCard key={item.id} item={item} currentUserId={kakaoUser?.id} currentUserName={kakaoUser?.nickname} />
            ))
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
                      if (e.key === 'Enter' && !e.shiftKey) {
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
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-24 border-3 border-dashed border-gray-900 flex flex-col items-center justify-center bg-white text-gray-700 hover:bg-[#FFE66D] transition-all cursor-pointer"
                  style={{borderWidth: '3px'}}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept={activeTab === ContentType.IMAGE ? "image/*" : "video/*"}
                    onChange={handleFileUpload}
                  />
                  <div className="p-3 bg-[#4ECDC4] border-2 border-gray-900 mb-2">
                    {activeTab === ContentType.IMAGE ? <ImageIcon className="w-5 h-5" /> : <Film className="w-5 h-5" />}
                  </div>
                  <span className="text-sm font-bold">클릭하여 {activeTab === ContentType.IMAGE ? '사진' : '동영상'} 선택</span>
                  <span className="text-xs text-gray-500 mt-1 font-medium">최대 10MB</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
