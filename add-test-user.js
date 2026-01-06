import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';

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

// 테스트 사용자 데이터
const testUser = {
  id: 'test_user_001',
  name: '테스트 사용자',
  type: 'user',
  profileImage: null,
  lastSeen: Date.now()
};

// Firebase에 테스트 사용자 등록
const deviceRef = ref(database, `devices/${testUser.id}`);
set(deviceRef, testUser)
  .then(() => {
    console.log('테스트 사용자가 성공적으로 추가되었습니다:');
    console.log(testUser);
    process.exit(0);
  })
  .catch((error) => {
    console.error('오류 발생:', error);
    process.exit(1);
  });
