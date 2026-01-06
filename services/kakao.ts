// 카카오 SDK 타입 선언
declare global {
  interface Window {
    Kakao: any;
  }
}

const KAKAO_JS_KEY = 'ec4c8aa4ebd3165953d1ba50006d8a4c';

// 카카오 SDK 초기화
export const initKakao = () => {
  if (window.Kakao && !window.Kakao.isInitialized()) {
    window.Kakao.init(KAKAO_JS_KEY);
    console.log('Kakao SDK initialized:', window.Kakao.isInitialized());
  }
};

// 카카오 로그인 (최신 SDK 방식)
export const kakaoLogin = (): Promise<KakaoUser | null> => {
  return new Promise((resolve, reject) => {
    if (!window.Kakao) {
      console.error('Kakao SDK not loaded');
      reject(new Error('Kakao SDK not loaded'));
      return;
    }

    if (!window.Kakao.isInitialized()) {
      console.error('Kakao SDK not initialized');
      initKakao();
    }

    // 최신 SDK 방식 사용
    window.Kakao.Auth.login({
      scope: 'profile_nickname,profile_image',
      success: (authObj: any) => {
        console.log('Kakao auth success:', authObj);
        // 로그인 성공 후 사용자 정보 가져오기
        window.Kakao.API.request({
          url: '/v2/user/me',
          success: (res: any) => {
            console.log('User info:', res);
            const user: KakaoUser = {
              id: res.id,
              nickname: res.kakao_account?.profile?.nickname || res.properties?.nickname || '사용자',
              profileImage: res.kakao_account?.profile?.profile_image_url || res.properties?.profile_image || null,
            };
            // 로컬스토리지에 저장
            localStorage.setItem('kakao_user', JSON.stringify(user));
            resolve(user);
          },
          fail: (error: any) => {
            console.error('Failed to get user info:', error);
            reject(error);
          },
        });
      },
      fail: (error: any) => {
        console.error('Kakao login failed:', error);
        reject(error);
      },
    });
  });
};

// 카카오 로그아웃
export const kakaoLogout = (): Promise<void> => {
  return new Promise((resolve) => {
    if (window.Kakao && window.Kakao.Auth.getAccessToken()) {
      window.Kakao.Auth.logout(() => {
        console.log('Kakao logout success');
        localStorage.removeItem('kakao_user');
        resolve();
      });
    } else {
      localStorage.removeItem('kakao_user');
      resolve();
    }
  });
};

// 저장된 사용자 정보 가져오기
export const getStoredUser = (): KakaoUser | null => {
  const stored = localStorage.getItem('kakao_user');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

// 카카오 사용자 타입
export interface KakaoUser {
  id: number;
  nickname: string;
  profileImage: string | null;
}
