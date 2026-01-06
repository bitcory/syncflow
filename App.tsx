import React, { useState, useEffect, useRef } from 'react';
import { SharedItem, ContentType, DeviceProfile, Notification } from './types';
import { FeedItemCard } from './components/FeedItemCard';
import { NotificationToast } from './components/NotificationToast';
import {
  sharedItemsRef,
  devicesRef,
  chatRoomsRef,
  adminsRef,
  allRoomMembersRef,
  addSharedItem as firebaseAddItem,
  addMessageToRoom,
  createChatRoom,
  clearRoomMessages,
  getRoomMessagesRef,
  registerDevice,
  cleanupStaleDevices,
  clearAllSharedItems,
  deleteSharedItem,
  addReply,
  getRepliesRef,
  setAdmin,
  addUserToRoom,
  removeUserFromRoom,
  uploadFileToStorage,
  onValue
} from './services/firebase';
import { initKakao, kakaoLogin, kakaoLogout, getStoredUser, KakaoUser } from './services/kakao';
import {
  Wifi,
  Send,
  Image as ImageIcon,
  FileText,
  Film,
  Loader2,
  Menu,
  X,
  Zap,
  MessageCircle,
  RefreshCw,
  LogOut,
  User,
  ChevronDown,
  ChevronUp,
  Users,
  Search,
  Copy,
  Download,
  Check,
  Plus,
  Hash,
  Shield,
  UserPlus,
  Crown,
  UserMinus,
  Upload
} from 'lucide-react';

// 슈퍼관리자 이름 (고정)
const SUPER_ADMIN_NAME = '김진욱';

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
  const [replies, setReplies] = useState<any[]>([]);
  const [replyInput, setReplyInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [adminList, setAdminList] = useState<string[]>([]);
  const [selectedUserForRoom, setSelectedUserForRoom] = useState<DeviceProfile | null>(null);
  const [isRoomSelectOpen, setIsRoomSelectOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [roomMembers, setRoomMembers] = useState<Record<string, Record<string, any>>>({});
  const [userRoomIds, setUserRoomIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
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

  // Firebase 연결 및 기기 목록 구독
  useEffect(() => {
    setIsConnecting(true);

    // 오래된 기기 정리
    cleanupStaleDevices();

    // 연결된 기기 목록 구독
    const unsubscribeDevices = onValue(devicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const devices: DeviceProfile[] = Object.values(data);
        setAvailableDevices(devices);
      } else {
        setAvailableDevices([]);
      }
      setIsConnecting(false);
      setIsConnected(true);
    }, (error) => {
      console.error('Firebase 연결 오류:', error);
      setIsConnecting(false);
      setIsConnected(false);
      addNotification('연결 실패', 'error');
    });

    // 정리
    return () => {
      unsubscribeDevices();
    };
  }, []);

  // 기본 채팅방 (전체 채팅) 구독 - 채팅방 선택 안 됐을 때
  useEffect(() => {
    if (currentRoomId) return; // 채팅방 선택 시 기본 채팅 비활성화

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
    });

    return () => unsubscribeItems();
  }, [currentRoomId]);

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

  // 채팅방 목록 구독
  useEffect(() => {
    const unsubscribe = onValue(chatRoomsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const rooms = Object.entries(data)
          .map(([key, value]: [string, any]) => ({
            id: key,
            ...value,
            createdAt: value.createdAt || Date.now()
          }))
          .sort((a, b) => b.createdAt - a.createdAt);
        setChatRooms(rooms);
      } else {
        setChatRooms([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // 관리자 목록 구독
  useEffect(() => {
    const unsubscribe = onValue(adminsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const admins = Object.keys(data);
        setAdminList(admins);
      } else {
        setAdminList([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // 모든 채팅방 멤버십 구독
  useEffect(() => {
    const unsubscribe = onValue(allRoomMembersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoomMembers(data);
      } else {
        setRoomMembers({});
      }
    });

    return () => unsubscribe();
  }, []);

  // 현재 사용자가 속한 방 ID 목록 계산
  useEffect(() => {
    if (!kakaoUser) {
      setUserRoomIds([]);
      return;
    }

    const userId = String(kakaoUser.id);
    const roomIds: string[] = [];
    Object.entries(roomMembers).forEach(([roomId, members]) => {
      if (members && members[userId]) {
        roomIds.push(roomId);
      }
    });
    setUserRoomIds(roomIds);
  }, [kakaoUser, roomMembers]);

  // 슈퍼관리자 여부 확인
  const isSuperAdmin = kakaoUser?.nickname === SUPER_ADMIN_NAME;

  // 관리자 여부 확인 (슈퍼관리자 포함)
  const isAdmin = isSuperAdmin || (kakaoUser && adminList.includes(String(kakaoUser.id)));

  // 일반 사용자가 방이 배정되면 자동으로 첫 번째 방으로 이동
  useEffect(() => {
    if (!isAdmin && userRoomIds.length > 0 && currentRoomId === null) {
      setCurrentRoomId(userRoomIds[0]);
    }
  }, [isAdmin, userRoomIds, currentRoomId]);

  // 채팅방별 메시지 구독
  useEffect(() => {
    if (!currentRoomId) return;

    const messagesRef = getRoomMessagesRef(currentRoomId);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
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
      } else {
        setSharedItems([]);
      }
    });

    return () => unsubscribe();
  }, [currentRoomId]);

  // 선택된 메시지의 댓글 구독
  useEffect(() => {
    if (!selectedMessage) {
      setReplies([]);
      return;
    }

    const repliesRef = getRepliesRef(selectedMessage.id);
    const unsubscribe = onValue(repliesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const replyList = Object.entries(data)
          .map(([key, value]: [string, any]) => ({
            id: key,
            ...value,
            timestamp: value.timestamp || value.createdAt
          }))
          .sort((a, b) => a.timestamp - b.timestamp);
        setReplies(replyList);
        // 새 댓글 시 스크롤
        setTimeout(() => {
          if (threadRef.current) {
            threadRef.current.scrollTop = threadRef.current.scrollHeight;
          }
        }, 100);
      } else {
        setReplies([]);
      }
    });

    return () => unsubscribe();
  }, [selectedMessage]);

  const addNotification = (message: string, type: 'success' | 'info' | 'error') => {
    const id = Date.now().toString() + Math.random();
    setNotifications(prev => [...prev, { id, message, type }]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClearAll = async () => {
    const roomName = getCurrentRoomName();
    const password = prompt(`"${roomName}" 채팅방의 모든 내용을 삭제합니다.\n비밀번호를 입력하세요:`);
    if (password === '1004') {
      try {
        if (currentRoomId) {
          await clearRoomMessages(currentRoomId);
        } else {
          await clearAllSharedItems();
        }
        addNotification('모든 내용이 삭제되었습니다', 'success');
      } catch (err) {
        addNotification('삭제 실패', 'error');
      }
    } else if (password !== null) {
      addNotification('비밀번호가 틀렸습니다', 'error');
    }
  };

  // 댓글 전송
  const handleSendReply = async () => {
    if (!replyInput.trim() || !selectedMessage) return;

    const newReply = {
      content: replyInput,
      sender: kakaoUser?.nickname || currentDevice.name,
      senderImage: kakaoUser?.profileImage || null,
      senderId: kakaoUser?.id || null,
      timestamp: Date.now()
    };

    try {
      await addReply(selectedMessage.id, newReply);
      setReplyInput('');
    } catch (error) {
      console.error('댓글 전송 실패:', error);
      addNotification('댓글 전송 실패', 'error');
    }
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

  // 메시지 복사 (스레드에서)
  const handleCopyMessage = async () => {
    if (!selectedMessage || selectedMessage.type !== ContentType.TEXT) return;
    try {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = selectedMessage.content;
      const decodedText = textarea.value;
      await navigator.clipboard.writeText(decodedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      addNotification('복사 실패', 'error');
    }
  };

  // 미디어 다운로드 (스레드에서)
  const handleDownloadMedia = () => {
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

  // 채팅방 생성
  const handleCreateRoom = async () => {
    if (!newRoomName.trim() || !kakaoUser) return;

    try {
      const roomRef = await createChatRoom({
        name: newRoomName.trim(),
        createdBy: String(kakaoUser.id),
        creatorName: kakaoUser.nickname,
        creatorImage: kakaoUser.profileImage
      });
      setNewRoomName('');
      setIsCreatingRoom(false);
      setCurrentRoomId(roomRef.key);
      addNotification(`"${newRoomName.trim()}" 채팅방이 생성되었습니다`, 'success');
    } catch (error) {
      console.error('채팅방 생성 실패:', error);
      addNotification('채팅방 생성에 실패했습니다', 'error');
    }
  };

  // 현재 채팅방 이름 가져오기
  const getCurrentRoomName = () => {
    if (!currentRoomId) return '전체 채팅';
    const room = chatRooms.find(r => r.id === currentRoomId);
    return room?.name || '채팅방';
  };

  // 관리자 지정/해제 (슈퍼관리자만)
  const handleToggleAdmin = async (userId: string, userName: string, currentlyAdmin: boolean) => {
    if (!isSuperAdmin) return;

    try {
      await setAdmin(userId, !currentlyAdmin);
      addNotification(
        currentlyAdmin
          ? `${userName}님의 관리자 권한이 해제되었습니다`
          : `${userName}님이 관리자로 지정되었습니다`,
        'success'
      );
    } catch (error) {
      console.error('관리자 지정 실패:', error);
      addNotification('관리자 지정에 실패했습니다', 'error');
    }
  };

  // 사용자를 채팅방에 추가
  const handleAddUserToRoom = async (roomId: string) => {
    if (!selectedUserForRoom || !isAdmin) return;

    try {
      await addUserToRoom(roomId, selectedUserForRoom.id, {
        name: selectedUserForRoom.name,
        profileImage: selectedUserForRoom.profileImage
      });

      const room = chatRooms.find(r => r.id === roomId);
      addNotification(`${selectedUserForRoom.name}님이 "${room?.name}" 채팅방에 추가되었습니다`, 'success');
      setSelectedUserForRoom(null);
      setIsRoomSelectOpen(false);
    } catch (error) {
      console.error('사용자 추가 실패:', error);
      addNotification('사용자 추가에 실패했습니다', 'error');
    }
  };

  // 특정 사용자가 관리자인지 확인
  const isUserAdmin = (userId: string) => adminList.includes(userId);

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
      if (currentRoomId) {
        await addMessageToRoom(currentRoomId, newItem);
      } else {
        await firebaseAddItem(newItem);
      }
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

    // Firebase Storage 사용 - 100MB까지 허용
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      addNotification(`파일이 너무 큽니다 (${sizeMB}MB). 100MB 이하만 지원됩니다.`, 'error');
      return;
    }

    try {
      addNotification('파일 업로드 중...', 'info');

      // Storage에 파일 업로드
      const userId = kakaoUser?.id ? String(kakaoUser.id) : currentDevice.id;
      const downloadURL = await uploadFileToStorage(file, currentRoomId, userId);

      const newItem = {
        type: isVideo ? ContentType.VIDEO : ContentType.IMAGE,
        content: downloadURL,
        fileName: file.name,
        sender: kakaoUser?.nickname || currentDevice.name,
        senderImage: kakaoUser?.profileImage || null,
        senderId: kakaoUser?.id || null,
        timestamp: Date.now()
      };

      if (currentRoomId) {
        await addMessageToRoom(currentRoomId, newItem);
      } else {
        await firebaseAddItem(newItem);
      }

      addNotification('파일이 전송되었습니다', 'success');
    } catch (error) {
      console.error('전송 실패:', error);
      addNotification('전송 실패', 'error');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 파일 처리 공통 함수 (드래그앤드롭, 클립보드용)
  const processFile = async (file: File) => {
    const isVideo = file.type.startsWith('video');
    const isImage = file.type.startsWith('image');

    if (!isVideo && !isImage) {
      addNotification('이미지와 비디오만 지원됩니다.', 'error');
      return;
    }

    // Firebase Storage 사용 - 100MB까지 허용
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      addNotification(`파일이 너무 큽니다 (${sizeMB}MB). 100MB 이하만 지원됩니다.`, 'error');
      return;
    }

    try {
      addNotification('파일 업로드 중...', 'info');

      // Storage에 파일 업로드
      const userId = kakaoUser?.id ? String(kakaoUser.id) : currentDevice.id;
      const downloadURL = await uploadFileToStorage(file, currentRoomId, userId);

      const newItem = {
        type: isVideo ? ContentType.VIDEO : ContentType.IMAGE,
        content: downloadURL,
        fileName: file.name,
        sender: kakaoUser?.nickname || currentDevice.name,
        senderImage: kakaoUser?.profileImage || null,
        senderId: kakaoUser?.id || null,
        timestamp: Date.now()
      };

      if (currentRoomId) {
        await addMessageToRoom(currentRoomId, newItem);
      } else {
        await firebaseAddItem(newItem);
      }

      addNotification(`${isImage ? '이미지' : '동영상'}가 전송되었습니다`, 'success');
    } catch (error: any) {
      console.error('전송 실패:', error);
      const errorMessage = error?.message || error?.code || '알 수 없는 오류';
      addNotification(`전송 실패: ${errorMessage}`, 'error');
    }
  };

  // 드래그 이벤트 핸들러
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 실제로 드롭존을 벗어났는지 확인
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await processFile(file);
    }
  };

  // 클립보드 붙여넣기 핸들러
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image') || item.type.startsWith('video')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await processFile(file);
        }
        return;
      }
    }
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

  // 로그인은 됐지만 방이 배정되지 않은 사용자 (관리자 제외) - 대기 화면
  if (!isAdmin && userRoomIds.length === 0) {
    // 현재 대기 중인 사용자 목록 (방이 없는 사용자들)
    const waitingUsers = availableDevices.filter(user => {
      const userIsAdmin = user.name === SUPER_ADMIN_NAME || adminList.includes(user.id);
      if (userIsAdmin) return false;

      // 해당 사용자가 어떤 방에도 속하지 않은지 확인
      const hasRoom = Object.values(roomMembers).some(members => members && members[user.id]);
      return !hasRoom;
    });

    return (
      <div className="min-h-screen memphis-bg flex items-center justify-center p-4">
        <NotificationToast notifications={notifications} removeNotification={removeNotification} />
        <div className="bg-white p-8 md:p-12 border-4 border-gray-900 shadow-[8px_8px_0px_#1a1a2e] max-w-md w-full text-center">
          <img src="/logo.png" alt="TB CHAT" className="w-24 h-24 mx-auto mb-6 rounded-full border-4 border-gray-900" />
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 mb-2">환영합니다, {kakaoUser.nickname}님!</h1>
          <p className="text-gray-600 font-medium mb-6">관리자가 채팅방을 배정해 드릴 때까지 잠시 기다려주세요.</p>

          <div className="bg-[#FFE66D] p-4 border-3 border-gray-900 mb-6" style={{border: '3px solid #1a1a2e'}}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-3 h-3 bg-[#4ECDC4] rounded-full animate-pulse border border-gray-900"></div>
              <span className="text-sm font-bold text-gray-900">대기 중</span>
            </div>
            <p className="text-xs text-gray-700">관리자가 곧 채팅방에 초대해 드립니다</p>
          </div>

          {/* 대기 중인 사용자 목록 */}
          {waitingUsers.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Users className="w-4 h-4 text-[#4ECDC4]" />
                <span className="text-sm font-bold text-gray-900">함께 대기 중인 사용자</span>
                <span className="px-2 py-0.5 bg-[#4ECDC4] text-xs font-bold border border-gray-900">{waitingUsers.length}</span>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {waitingUsers.map(user => {
                  const isMe = String(kakaoUser.id) === user.id;
                  return (
                    <div
                      key={user.id}
                      className={`flex items-center gap-2 px-3 py-2 text-sm border-2 border-gray-900 ${
                        isMe ? 'bg-[#4ECDC4]' : 'bg-white'
                      }`}
                    >
                      {user.profileImage ? (
                        <img src={user.profileImage} alt={user.name} className="w-6 h-6 rounded-full border border-gray-900" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[#FFE66D] border border-gray-900 flex items-center justify-center">
                          <span className="text-xs font-bold">{user.name.charAt(0)}</span>
                        </div>
                      )}
                      <span className="font-medium">{user.name}</span>
                      {isMe && <span className="text-xs text-gray-700">(나)</span>}
                      <div className="ml-auto w-2 h-2 bg-[#4ECDC4] rounded-full border border-gray-900"></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={handleKakaoLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-gray-100 text-gray-900 font-bold border-3 border-gray-900 transition-all"
            style={{border: '3px solid #1a1a2e'}}
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
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

        {/* Chat Rooms List */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-gray-900">채팅방</span>
            <button
              onClick={() => setIsCreatingRoom(true)}
              className="p-1.5 bg-white hover:bg-[#4ECDC4] border-2 border-gray-900 transition-colors"
              title="새 채팅방"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {/* 전체 채팅 - 관리자만 접근 가능 */}
            {isAdmin && (
              <button
                onClick={() => {
                  setCurrentRoomId(null);
                  setSelectedMessage(null);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold transition-all border-2 border-gray-900 ${
                  !currentRoomId
                    ? 'bg-[#4ECDC4] shadow-[3px_3px_0px_#1a1a2e]'
                    : 'bg-white hover:bg-gray-100'
                }`}
                style={!currentRoomId ? {boxShadow: '3px 3px 0px #1a1a2e'} : {}}
              >
                <MessageCircle className="w-5 h-5" />
                <span>전체 채팅</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-[#FFE66D] border border-gray-900 ml-auto">관리자</span>
              </button>
            )}

            {/* 생성된 채팅방들 - 관리자는 모든 방, 일반 사용자는 본인이 속한 방만 */}
            {chatRooms
              .filter(room => isAdmin || userRoomIds.includes(room.id))
              .map(room => {
                const isMember = userRoomIds.includes(room.id);
                return (
                  <button
                    key={room.id}
                    onClick={() => {
                      setCurrentRoomId(room.id);
                      setSelectedMessage(null);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold transition-all border-2 border-gray-900 ${
                      currentRoomId === room.id
                        ? 'bg-[#4ECDC4] shadow-[3px_3px_0px_#1a1a2e]'
                        : 'bg-white hover:bg-gray-100'
                    }`}
                    style={currentRoomId === room.id ? {boxShadow: '3px 3px 0px #1a1a2e'} : {}}
                  >
                    <Hash className="w-5 h-5" />
                    <span className="truncate">{room.name}</span>
                    {isAdmin && !isMember && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 border border-gray-900 ml-auto" title="미참여 방">관리</span>
                    )}
                  </button>
                );
              })}
          </div>
        </div>

        {/* User List - Compact with Dropdown */}
        <div className="mb-6" ref={userListRef}>
          {(() => {
            // 현재 방에 따라 접속 사용자 필터링
            const currentRoomMembers = currentRoomId ? roomMembers[currentRoomId] || {} : {};
            const filteredUsers = currentRoomId
              ? availableDevices.filter(user => {
                  // 관리자는 항상 표시
                  const userIsAdmin = user.name === SUPER_ADMIN_NAME || adminList.includes(user.id);
                  if (userIsAdmin) return true;
                  // 해당 방의 멤버만 표시
                  return currentRoomMembers[user.id];
                })
              : availableDevices; // 전체 채팅은 모든 사용자 표시

            return (
              <>
                <button
                  onClick={() => setIsUserListOpen(!isUserListOpen)}
                  className="w-full bg-white p-3 border-3 border-gray-900 shadow-[4px_4px_0px_#1a1a2e] flex items-center justify-between hover:bg-gray-50 transition-colors"
                  style={{border: '3px solid #1a1a2e', boxShadow: '4px 4px 0px #1a1a2e'}}
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-[#4ECDC4]" />
                    <span className="text-sm font-bold">접속 중인 사용자</span>
                    <span className="px-2 py-0.5 bg-[#4ECDC4] text-xs font-bold border-2 border-gray-900">{filteredUsers.length}</span>
                  </div>
                  {isUserListOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>

          {isUserListOpen && (
            <div className="mt-2 space-y-2">
              {filteredUsers.length > 0 ? (
                filteredUsers.map(user => {
                  const userIsSuperAdmin = user.name === SUPER_ADMIN_NAME;
                  const userIsAdmin = isUserAdmin(user.id);
                  const isMe = kakaoUser && String(kakaoUser.id) === user.id;

                  return (
                    <div
                      key={user.id}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-all border-2 border-gray-900 ${
                        isMe
                          ? 'bg-[#4ECDC4] shadow-[3px_3px_0px_#1a1a2e]'
                          : 'bg-white hover:bg-gray-100'
                      }`}
                      style={isMe ? {boxShadow: '3px 3px 0px #1a1a2e'} : {}}
                    >
                      {user.profileImage ? (
                        <img src={user.profileImage} alt={user.name} className="w-8 h-8 rounded-full border-2 border-gray-900 object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#FFE66D] border-2 border-gray-900 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold">{user.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-bold truncate">{user.name}</span>
                          {userIsSuperAdmin && (
                            <Crown className="w-4 h-4 text-[#FFD700] flex-shrink-0" title="슈퍼관리자" />
                          )}
                          {!userIsSuperAdmin && userIsAdmin && (
                            <Shield className="w-4 h-4 text-[#4ECDC4] flex-shrink-0" title="관리자" />
                          )}
                        </div>
                        {isMe && <div className="text-[10px] font-medium">나</div>}
                      </div>

                      {/* 관리자 컨트롤 버튼들 */}
                      {!isMe && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* 채팅방에 추가 버튼 (관리자만) */}
                          {isAdmin && chatRooms.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUserForRoom(user);
                                setIsRoomSelectOpen(true);
                              }}
                              className="p-1.5 bg-[#FFE66D] hover:bg-[#FFD93D] border border-gray-900 rounded transition-colors"
                              title="채팅방에 추가"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* 관리자 지정/해제 버튼 (슈퍼관리자만, 슈퍼관리자 본인 제외) */}
                          {isSuperAdmin && !userIsSuperAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleAdmin(user.id, user.name, userIsAdmin);
                              }}
                              className={`p-1.5 border border-gray-900 rounded transition-colors ${
                                userIsAdmin
                                  ? 'bg-[#FF6B6B] hover:bg-[#FF5252] text-white'
                                  : 'bg-[#4ECDC4] hover:bg-[#3dbdb5]'
                              }`}
                              title={userIsAdmin ? '관리자 해제' : '관리자 지정'}
                            >
                              {userIsAdmin ? <UserMinus className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      )}

                      <div className="w-2 h-2 bg-[#4ECDC4] rounded-full border border-gray-900 flex-shrink-0"></div>
                    </div>
                  );
                })
              ) : (
                 <div className="text-center py-4 text-gray-600 text-xs font-medium bg-white border-2 border-gray-900 border-dashed">
                   접속 중인 사용자가 없습니다
                 </div>
              )}
            </div>
          )}
              </>
            );
          })()}
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
      <main
        ref={dropZoneRef}
        className="flex-1 flex flex-col h-screen overflow-hidden relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* 드래그 오버레이 */}
        {isDragging && (
          <div className="absolute inset-0 z-40 bg-[#4ECDC4]/90 flex items-center justify-center pointer-events-none">
            <div className="bg-white border-4 border-gray-900 p-8 shadow-[8px_8px_0px_#1a1a2e]" style={{boxShadow: '8px 8px 0px #1a1a2e'}}>
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-[#FFE66D] border-3 border-gray-900 rounded-full flex items-center justify-center animate-bounce" style={{border: '3px solid #1a1a2e'}}>
                  <Upload className="w-10 h-10" />
                </div>
                <p className="text-xl font-bold text-gray-900">여기에 파일을 놓으세요</p>
                <p className="text-sm text-gray-600">이미지 또는 동영상 (최대 100MB)</p>
              </div>
            </div>
          </div>
        )}
        {/* Header */}
        <header className="h-16 border-b-4 border-gray-900 bg-[#4ECDC4] flex items-center gap-3 px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-gray-900 hover:bg-[#FF6B6B] hover:text-white transition-colors border-2 border-gray-900 bg-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* 현재 채팅방 이름 */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 border-2 border-gray-900">
              {currentRoomId ? <Hash className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
              <span className="font-bold text-sm">{getCurrentRoomName()}</span>
            </div>
          </div>

          {/* Search Input */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="메시지 검색..."
                className="w-full pl-10 pr-4 py-2 text-base border-2 border-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#FFE66D]"
                style={{ fontSize: '16px' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
          {(() => {
            const filteredItems = searchQuery.trim()
              ? sharedItems.filter(item =>
                  (item.type === ContentType.TEXT && item.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
                  item.sender.toLowerCase().includes(searchQuery.toLowerCase())
                )
              : sharedItems;

            if (sharedItems.length === 0) {
              return (
                <div className="h-full flex flex-col items-center justify-center">
                  <div className="bg-white p-8 border-3 border-gray-900 shadow-[6px_6px_0px_#1a1a2e] text-center" style={{border: '3px solid #1a1a2e', boxShadow: '6px 6px 0px #1a1a2e'}}>
                    <div className="w-20 h-20 bg-[#FFE66D] border-3 border-gray-900 flex items-center justify-center mx-auto mb-4" style={{border: '3px solid #1a1a2e'}}>
                      <MessageCircle className="w-10 h-10 text-gray-900" />
                    </div>
                    <p className="text-xl font-black text-gray-900 mb-2">공유된 항목이 없습니다</p>
                    <p className="text-sm text-gray-600 font-medium">텍스트, 이미지, 동영상을 공유해보세요!</p>
                  </div>
                </div>
              );
            }

            if (filteredItems.length === 0) {
              return (
                <div className="h-full flex flex-col items-center justify-center">
                  <div className="bg-white p-8 border-3 border-gray-900 shadow-[6px_6px_0px_#1a1a2e] text-center" style={{border: '3px solid #1a1a2e', boxShadow: '6px 6px 0px #1a1a2e'}}>
                    <Search className="w-10 h-10 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg font-bold text-gray-900 mb-2">검색 결과가 없습니다</p>
                    <p className="text-sm text-gray-600">"{searchQuery}"에 대한 결과를 찾을 수 없습니다</p>
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                {searchQuery && (
                  <div className="text-center py-2">
                    <span className="text-xs font-bold text-gray-500 bg-white px-3 py-1 border-2 border-gray-300 rounded-full">
                      {filteredItems.length}개의 검색 결과
                    </span>
                  </div>
                )}
                {filteredItems.map(item => (
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
            );
          })()}
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
                    placeholder="공유할 텍스트를 입력하세요... (이미지 붙여넣기 가능)"
                    className="w-full bg-white text-gray-900 placeholder-gray-500 p-4 pr-14 outline-none border-3 border-gray-900 shadow-[4px_4px_0px_#1a1a2e] transition-all resize-none h-24 font-medium focus:shadow-[6px_6px_0px_#1a1a2e] text-base"
                    style={{border: '3px solid #1a1a2e', boxShadow: '4px 4px 0px #1a1a2e', fontSize: '16px'}}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        handleSendText();
                      }
                    }}
                    onPaste={handlePaste}
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
                    <span className="text-xs text-gray-500 mt-1 font-medium">최대 100MB</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Thread Overlay */}
      {selectedMessage && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setSelectedMessage(null)}
        />
      )}

      {/* Right Panel - Thread/Replies */}
      {selectedMessage && (
        <aside className={`
          fixed inset-0 z-50 md:static md:z-auto
          md:w-96 bg-white md:border-l-4 border-gray-900 flex flex-col h-screen md:shrink-0
        `}>
          {/* Thread Header */}
          <div className="p-4 border-b-3 border-gray-900 flex items-center justify-between bg-[#4ECDC4]" style={{borderBottom: '3px solid #1a1a2e'}}>
            <h3 className="font-bold text-gray-900">스레드</h3>
            <button
              onClick={() => setSelectedMessage(null)}
              className="p-2 hover:bg-white/50 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Thread Content */}
          <div ref={threadRef} className="flex-1 overflow-y-auto">
            {/* Original Message */}
            <div className="p-4 border-b-2 border-gray-200 bg-gray-50">
              <div className="flex items-start gap-3">
                {selectedMessage.senderImage ? (
                  <img src={selectedMessage.senderImage} alt="" className="w-10 h-10 rounded-full border-2 border-gray-900 flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#FFE66D] border-2 border-gray-900 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold">{selectedMessage.sender.charAt(0)}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-sm">{selectedMessage.sender}</span>
                    <span className="text-xs text-gray-500">{formatDateTime(selectedMessage.timestamp)}</span>
                  </div>
                  {selectedMessage.type === ContentType.TEXT ? (
                    <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap break-words">{selectedMessage.content}</p>
                  ) : selectedMessage.type === ContentType.IMAGE ? (
                    <img
                      src={selectedMessage.content}
                      alt="Shared"
                      className="mt-2 max-w-full max-h-64 rounded-lg border-2 border-gray-900 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={handleDownloadMedia}
                    />
                  ) : (
                    <video
                      src={selectedMessage.content}
                      controls
                      className="mt-2 max-w-full max-h-64 rounded-lg border-2 border-gray-900"
                    />
                  )}
                  {/* Action Buttons */}
                  <div className="mt-3 flex gap-2">
                    {selectedMessage.type === ContentType.TEXT ? (
                      <button
                        onClick={handleCopyMessage}
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold border-2 border-gray-900 rounded transition-all ${copied ? 'bg-[#4ECDC4]' : 'bg-white hover:bg-[#FFE66D]'}`}
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? '복사됨!' : '복사'}
                      </button>
                    ) : (
                      <button
                        onClick={handleDownloadMedia}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold border-2 border-gray-900 rounded bg-white hover:bg-[#FFE66D] transition-all"
                      >
                        <Download className="w-3 h-3" />
                        다운로드
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Reply Count */}
            {replies.length > 0 && (
              <div className="px-4 py-2 text-xs font-bold text-gray-500 border-b border-gray-200">
                {replies.length}개의 댓글
              </div>
            )}

            {/* Replies */}
            <div className="p-4 space-y-4">
              {replies.map((reply) => {
                const isMyReply = kakaoUser && (reply.senderId === kakaoUser.id || String(reply.senderId) === String(kakaoUser.id));
                return (
                  <div key={reply.id} className={`flex items-start gap-3 ${isMyReply ? 'flex-row-reverse' : ''}`}>
                    {reply.senderImage ? (
                      <img src={reply.senderImage} alt="" className="w-8 h-8 rounded-full border-2 border-gray-900 flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#4ECDC4] border-2 border-gray-900 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold">{reply.sender?.charAt(0) || '?'}</span>
                      </div>
                    )}
                    <div className={`flex-1 min-w-0 ${isMyReply ? 'text-right' : ''}`}>
                      <div className={`flex items-center gap-2 ${isMyReply ? 'justify-end' : ''}`}>
                        <span className="font-bold text-gray-900 text-xs">{reply.sender}</span>
                        <span className="text-[10px] text-gray-500">
                          {new Date(reply.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={`mt-1 inline-block px-3 py-2 rounded-2xl text-sm ${isMyReply ? 'bg-[#FFE66D] rounded-tr-none' : 'bg-white border-2 border-gray-900 rounded-tl-none'}`}
                           style={!isMyReply ? {boxShadow: '2px 2px 0px #1a1a2e'} : {}}>
                        <p className="text-gray-900 whitespace-pre-wrap break-words">{reply.content}</p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {replies.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  아직 댓글이 없습니다
                </div>
              )}
            </div>
          </div>

          {/* Reply Input */}
          <div className="p-4 border-t-3 border-gray-900 bg-gray-50" style={{borderTop: '3px solid #1a1a2e'}}>
            <div className="flex gap-2">
              <input
                type="text"
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                placeholder="댓글을 입력하세요..."
                className="flex-1 px-4 py-2 border-2 border-gray-900 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]"
                style={{ fontSize: '16px' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
              />
              <button
                onClick={handleSendReply}
                disabled={!replyInput.trim()}
                className="px-4 py-2 bg-[#4ECDC4] hover:bg-[#3dbdb5] disabled:bg-gray-300 text-gray-900 font-bold border-2 border-gray-900 rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Room Creation Modal */}
      {isCreatingRoom && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setIsCreatingRoom(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white border-4 border-gray-900 shadow-[8px_8px_0px_#1a1a2e] w-full max-w-md" style={{boxShadow: '8px 8px 0px #1a1a2e'}}>
              <div className="p-4 border-b-3 border-gray-900 bg-[#FFE66D] flex items-center justify-between" style={{borderBottom: '3px solid #1a1a2e'}}>
                <h3 className="font-bold text-gray-900 text-lg">새 채팅방 만들기</h3>
                <button
                  onClick={() => setIsCreatingRoom(false)}
                  className="p-1.5 hover:bg-white/50 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  채팅방 이름
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="채팅방 이름을 입력하세요"
                  className="w-full px-4 py-3 border-3 border-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]"
                  style={{border: '3px solid #1a1a2e', fontSize: '16px'}}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      handleCreateRoom();
                    }
                  }}
                />
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setIsCreatingRoom(false)}
                    className="flex-1 px-4 py-3 bg-white border-3 border-gray-900 font-bold hover:bg-gray-100 transition-colors"
                    style={{border: '3px solid #1a1a2e'}}
                  >
                    취소
                  </button>
                  <button
                    onClick={handleCreateRoom}
                    disabled={!newRoomName.trim()}
                    className="flex-1 px-4 py-3 bg-[#4ECDC4] border-3 border-gray-900 font-bold hover:bg-[#3dbdb5] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-[4px_4px_0px_#1a1a2e]"
                    style={{border: '3px solid #1a1a2e', boxShadow: '4px 4px 0px #1a1a2e'}}
                  >
                    만들기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Room Selection Modal (for adding user to room) */}
      {isRoomSelectOpen && selectedUserForRoom && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => {
              setIsRoomSelectOpen(false);
              setSelectedUserForRoom(null);
            }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white border-4 border-gray-900 shadow-[8px_8px_0px_#1a1a2e] w-full max-w-md" style={{boxShadow: '8px 8px 0px #1a1a2e'}}>
              <div className="p-4 border-b-3 border-gray-900 bg-[#4ECDC4] flex items-center justify-between" style={{borderBottom: '3px solid #1a1a2e'}}>
                <h3 className="font-bold text-gray-900 text-lg">채팅방에 추가</h3>
                <button
                  onClick={() => {
                    setIsRoomSelectOpen(false);
                    setSelectedUserForRoom(null);
                  }}
                  className="p-1.5 hover:bg-white/50 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                {/* 선택된 사용자 정보 */}
                <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 border-2 border-gray-900 rounded">
                  {selectedUserForRoom.profileImage ? (
                    <img src={selectedUserForRoom.profileImage} alt="" className="w-10 h-10 rounded-full border-2 border-gray-900" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#FFE66D] border-2 border-gray-900 flex items-center justify-center">
                      <span className="font-bold">{selectedUserForRoom.name.charAt(0)}</span>
                    </div>
                  )}
                  <span className="font-bold">{selectedUserForRoom.name}</span>
                </div>

                <label className="block text-sm font-bold text-gray-900 mb-3">
                  추가할 채팅방 선택
                </label>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {chatRooms.map(room => (
                    <button
                      key={room.id}
                      onClick={() => handleAddUserToRoom(room.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-[#FFE66D] border-2 border-gray-900 transition-colors text-left"
                    >
                      <Hash className="w-5 h-5 flex-shrink-0" />
                      <span className="font-bold truncate">{room.name}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setIsRoomSelectOpen(false);
                    setSelectedUserForRoom(null);
                  }}
                  className="w-full mt-4 px-4 py-3 bg-gray-100 border-2 border-gray-900 font-bold hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
