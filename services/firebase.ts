import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, serverTimestamp, onDisconnect, set, remove, get, update } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyB9V_o6P_5jHhwm5Q8650FFVIZSU6C9F5U",
  authDomain: "syncflow-3f605.firebaseapp.com",
  databaseURL: "https://syncflow-3f605-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "syncflow-3f605",
  storageBucket: "syncflow-3f605.firebasestorage.app",
  messagingSenderId: "444822213456",
  appId: "1:444822213456:web:03bb96161246aef16d5255",
  measurementId: "G-BPCLB5K7JR"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app);

// 채팅방 레퍼런스
export const chatRoomsRef = ref(database, 'chatRooms');

// 연결된 기기 레퍼런스
export const devicesRef = ref(database, 'devices');

// 기존 공유 아이템 레퍼런스 (기본 채팅방용 - 호환성)
export const sharedItemsRef = ref(database, 'sharedItems');

// 채팅방별 메시지 레퍼런스
export const getRoomMessagesRef = (roomId: string) => {
  return ref(database, `messages/${roomId}`);
};

// 채팅방 생성
export const createChatRoom = (roomData: { name: string; createdBy: string; creatorName: string; creatorImage?: string }) => {
  return push(chatRoomsRef, {
    ...roomData,
    createdAt: serverTimestamp()
  });
};

// 채팅방에 메시지 추가
export const addMessageToRoom = (roomId: string, message: any) => {
  const messagesRef = getRoomMessagesRef(roomId);
  return push(messagesRef, {
    ...message,
    createdAt: serverTimestamp()
  });
};

// 새 아이템 추가 (기본 채팅방용 - 호환성)
export const addSharedItem = (item: any) => {
  return push(sharedItemsRef, {
    ...item,
    createdAt: serverTimestamp()
  });
};

// 기기 등록
export const registerDevice = (deviceId: string, deviceInfo: any) => {
  const deviceRef = ref(database, `devices/${deviceId}`);

  const updatePresence = () => {
    set(deviceRef, {
      ...deviceInfo,
      lastSeen: Date.now()
    });
  };

  // 초기 등록
  updatePresence();

  // 30초마다 lastSeen 업데이트 (heartbeat)
  const heartbeat = setInterval(updatePresence, 30000);

  // 연결 해제 시 자동 삭제
  onDisconnect(deviceRef).remove();

  // heartbeat 정리를 위한 cleanup 함수 반환
  return () => {
    clearInterval(heartbeat);
    remove(deviceRef);
  };
};

// 기기 등록 해제
export const unregisterDevice = (deviceId: string) => {
  const deviceRef = ref(database, `devices/${deviceId}`);
  return remove(deviceRef);
};

// 오래된 기기 정리 (60초 이상 응답 없는 기기)
export const cleanupStaleDevices = async () => {
  const snapshot = await get(devicesRef);
  const data = snapshot.val();

  if (data) {
    const now = Date.now();
    const staleThreshold = 60000; // 60초

    Object.entries(data).forEach(([deviceId, deviceInfo]: [string, any]) => {
      if (deviceInfo.lastSeen && now - deviceInfo.lastSeen > staleThreshold) {
        remove(ref(database, `devices/${deviceId}`));
      }
    });
  }
};

// 모든 공유 아이템 삭제 (기본 채팅방)
export const clearAllSharedItems = () => {
  return remove(sharedItemsRef);
};

// 채팅방 메시지 전체 삭제
export const clearRoomMessages = (roomId: string) => {
  const messagesRef = getRoomMessagesRef(roomId);
  return remove(messagesRef);
};

// 특정 아이템 삭제 (기본 채팅방)
export const deleteSharedItem = (itemId: string) => {
  const itemRef = ref(database, `sharedItems/${itemId}`);
  return remove(itemRef);
};

// 채팅방 메시지 삭제
export const deleteRoomMessage = (roomId: string, messageId: string) => {
  const messageRef = ref(database, `messages/${roomId}/${messageId}`);
  return remove(messageRef);
};

// 댓글 추가
export const addReply = (itemId: string, reply: any) => {
  const repliesRef = ref(database, `replies/${itemId}`);
  return push(repliesRef, {
    ...reply,
    createdAt: serverTimestamp()
  });
};

// 댓글 레퍼런스 가져오기
export const getRepliesRef = (itemId: string) => {
  return ref(database, `replies/${itemId}`);
};

// 채팅방 삭제
export const deleteChatRoom = (roomId: string) => {
  const roomRef = ref(database, `chatRooms/${roomId}`);
  return remove(roomRef);
};

// 관리자 레퍼런스
export const adminsRef = ref(database, 'admins');

// 채팅방 멤버 레퍼런스
export const getRoomMembersRef = (roomId: string) => {
  return ref(database, `roomMembers/${roomId}`);
};

// 관리자 지정
export const setAdmin = (userId: string, isAdmin: boolean) => {
  const adminRef = ref(database, `admins/${userId}`);
  if (isAdmin) {
    return set(adminRef, { isAdmin: true, assignedAt: serverTimestamp() });
  } else {
    return remove(adminRef);
  }
};

// 사용자를 채팅방에 추가
export const addUserToRoom = (roomId: string, userId: string, userInfo: { name: string; profileImage?: string }) => {
  const memberRef = ref(database, `roomMembers/${roomId}/${userId}`);
  return set(memberRef, {
    ...userInfo,
    addedAt: serverTimestamp()
  });
};

// 사용자를 채팅방에서 제거
export const removeUserFromRoom = (roomId: string, userId: string) => {
  const memberRef = ref(database, `roomMembers/${roomId}/${userId}`);
  return remove(memberRef);
};

// 채팅방 멤버 목록 가져오기
export const getRoomMembers = async (roomId: string) => {
  const membersRef = getRoomMembersRef(roomId);
  const snapshot = await get(membersRef);
  return snapshot.val();
};

// Firebase Storage에 파일 업로드
export const uploadFileToStorage = async (
  file: File,
  roomId: string | null,
  userId: string
): Promise<string> => {
  // 고유한 파일 경로 생성
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const folder = roomId ? `rooms/${roomId}` : 'general';
  const path = `chat-media/${folder}/${userId}/${timestamp}_${safeName}`;

  const fileRef = storageRef(storage, path);

  // 파일 업로드
  const snapshot = await uploadBytes(fileRef, file);

  // 다운로드 URL 반환
  const downloadURL = await getDownloadURL(snapshot.ref);
  return downloadURL;
};

export { database, storage, ref, onValue };
