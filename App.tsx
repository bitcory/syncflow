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
  onValue
} from './services/firebase';
import {
  Wifi,
  Send,
  Image as ImageIcon,
  FileText,
  Film,
  Settings,
  Smartphone,
  Monitor,
  Share2,
  Loader2,
  Laptop,
  Menu,
  X,
  Cloud
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processedIds = useRef<Set<string>>(new Set());

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
      addNotification('Firebase 연결 실패', 'error');
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

    // 초기 알림
    setTimeout(() => {
      if (isConnected) {
        addNotification('Firebase 연결됨', 'success');
      }
    }, 1000);

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

  const handleSendText = async () => {
    if (!textInput.trim()) return;

    const newItem = {
      type: ContentType.TEXT,
      content: textInput,
      sender: currentDevice.name,
      timestamp: Date.now()
    };

    try {
      await firebaseAddItem(newItem);
      setTextInput('');
      addNotification('텍스트 전송 완료', 'success');
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

    // 파일 크기 체크 (10MB 제한 - Firebase 무료 티어 고려)
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
        sender: currentDevice.name,
        timestamp: Date.now()
      };

      try {
        await firebaseAddItem(newItem);
        addNotification(`${isVideo ? '동영상' : '이미지'} 전송 완료`, 'success');
      } catch (error) {
        console.error('전송 실패:', error);
        addNotification('전송 실패', 'error');
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col md:flex-row font-sans">
      <NotificationToast notifications={notifications} removeNotification={removeNotification} />

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar / Navigation */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-80 bg-slate-900 border-r border-slate-800 p-6 flex flex-col h-screen
        transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Share2 className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">SyncFlow</h1>
              <p className="text-xs text-slate-500">실시간 크로스 디바이스 공유</p>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Connection Status */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 mb-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase">연결 상태</span>
            <div className={`flex items-center gap-1.5 ${isConnecting ? 'text-amber-400' : (isConnected ? 'text-emerald-400' : 'text-red-400')}`}>
              {isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cloud className="w-3 h-3" />}
              <span className="text-xs font-bold">
                {isConnecting ? '연결 중...' : (isConnected ? '연결됨' : '연결 안됨')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Wifi className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-slate-300">인터넷 연결로 어디서든 동기화</span>
          </div>
        </div>

        {/* Device Discovery Section */}
        <div className="mb-6 flex-1">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold text-slate-400 uppercase">
              연결된 기기 ({availableDevices.length})
            </label>
          </div>

          <div className="space-y-2">
            {availableDevices.length > 0 ? (
              availableDevices.map(dev => (
                <div
                  key={dev.id}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    dev.id === deviceId
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                      : 'bg-slate-800/50 text-slate-400 border border-transparent'
                  }`}
                >
                  {dev.type === 'mobile' && <Smartphone className="w-4 h-4" />}
                  {dev.type === 'laptop' && <Laptop className="w-4 h-4" />}
                  {dev.type === 'desktop' && <Monitor className="w-4 h-4" />}
                  <div className="flex-1 text-left">
                    <div className="font-medium">{dev.name}</div>
                    {dev.id === deviceId && <div className="text-[10px] opacity-70">현재 기기</div>}
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                </div>
              ))
            ) : (
               <div className="text-center py-6 text-slate-500 text-xs">
                 연결된 기기가 없습니다.
               </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="mt-auto pt-6 border-t border-slate-800">
          <div className="text-xs text-slate-500 leading-relaxed">
            <strong className="text-slate-400">사용 방법:</strong><br/>
            다른 기기에서 같은 URL을 열면<br/>
            자동으로 실시간 동기화됩니다.
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-slate-400 hover:text-white transition-colors -ml-2"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-slate-400 text-sm hidden sm:inline">현재 기기:</span>
            <span className="text-white font-medium text-sm flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
              {currentDevice.type === 'mobile' ? <Smartphone className="w-3 h-3" /> : (currentDevice.type === 'laptop' ? <Laptop className="w-3 h-3"/> : <Monitor className="w-3 h-3" />)}
              <span className="hidden sm:inline">{currentDevice.name}</span>
              <span className="sm:hidden">{currentDevice.name.split(' ')[0]}</span>
            </span>
          </div>
          <button className="text-slate-400 hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </header>

        {/* Feed Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {sharedItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
              <Share2 className="w-16 h-16 mb-4" />
              <p className="text-lg font-medium">공유된 항목이 없습니다</p>
              <p className="text-sm">텍스트, 이미지, 동영상을 공유해보세요</p>
            </div>
          ) : (
            sharedItems.map(item => (
              <FeedItemCard key={item.id} item={item} />
            ))
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-slate-900 border-t border-slate-800 shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab(ContentType.TEXT)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === ContentType.TEXT ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <FileText className="w-4 h-4" /> 텍스트
              </button>
              <button
                onClick={() => setActiveTab(ContentType.IMAGE)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === ContentType.IMAGE ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <ImageIcon className="w-4 h-4" /> 사진
              </button>
              <button
                onClick={() => setActiveTab(ContentType.VIDEO)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === ContentType.VIDEO ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Film className="w-4 h-4" /> 동영상
              </button>
            </div>

            <div className="relative">
              {activeTab === ContentType.TEXT ? (
                <div className="relative group">
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="공유할 텍스트를 입력하거나 붙여넣으세요..."
                    className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded-xl p-4 pr-14 outline-none border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none h-24"
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
                    className="absolute right-3 bottom-3 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white rounded-lg transition-all shadow-lg hover:shadow-blue-600/20"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-24 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:border-slate-600 hover:text-slate-200 transition-all cursor-pointer group"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept={activeTab === ContentType.IMAGE ? "image/*" : "video/*"}
                    onChange={handleFileUpload}
                  />
                  <div className="p-3 bg-slate-700 group-hover:bg-slate-600 rounded-full mb-2 transition-colors">
                    {activeTab === ContentType.IMAGE ? <ImageIcon className="w-5 h-5" /> : <Film className="w-5 h-5" />}
                  </div>
                  <span className="text-xs font-medium">클릭하여 {activeTab === ContentType.IMAGE ? '사진' : '동영상'}을 선택하세요</span>
                  <span className="text-[10px] text-slate-500 mt-1">최대 10MB</span>
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
