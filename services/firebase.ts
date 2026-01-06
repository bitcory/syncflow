import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, serverTimestamp, onDisconnect, set, remove, get } from 'firebase/database';

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

// 공유 아이템 레퍼런스
export const sharedItemsRef = ref(database, 'sharedItems');

// 연결된 기기 레퍼런스
export const devicesRef = ref(database, 'devices');

// 새 아이템 추가
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

// 모든 공유 아이템 삭제
export const clearAllSharedItems = () => {
  return remove(sharedItemsRef);
};

export { database, ref, onValue };
