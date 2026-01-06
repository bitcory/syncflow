import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, serverTimestamp, onDisconnect, set, remove } from 'firebase/database';

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
  set(deviceRef, {
    ...deviceInfo,
    connectedAt: serverTimestamp()
  });

  // 연결 해제 시 자동 삭제
  onDisconnect(deviceRef).remove();

  return deviceRef;
};

// 기기 등록 해제
export const unregisterDevice = (deviceId: string) => {
  const deviceRef = ref(database, `devices/${deviceId}`);
  return remove(deviceRef);
};

export { database, ref, onValue };
