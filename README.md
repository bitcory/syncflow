# SyncFlow AI

Gemini AI로 구동되는 크로스 디바이스 파일 및 텍스트 공유 웹 애플리케이션 데모입니다.

## 배포 방법 (GitHub + Vercel)

이 프로젝트는 React + Vite로 구성되어 있어 Vercel에 매우 쉽게 배포할 수 있습니다.

### 1. GitHub 저장소 생성
1. GitHub에 새 Repository를 생성합니다 (예: `syncflow-ai`).
2. 이 코드를 해당 저장소에 Push합니다.

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/[사용자명]/syncflow-ai.git
git push -u origin main
```

### 2. Vercel 배포
1. [Vercel](https://vercel.com)에 로그인합니다.
2. **Add New Project**를 클릭하고 방금 만든 GitHub 저장소를 가져옵니다(Import).
3. **Environment Variables** (환경 변수) 섹션에 다음을 추가해야 AI 기능이 작동합니다:
   - `API_KEY`: Google Gemini API 키 (https://aistudio.google.com/ 에서 발급)
4. **Deploy** 버튼을 클릭합니다.

## 실제 기능 구현 가이드 (Backend)

현재 버전은 UI 및 인터랙션 **프로토타입**입니다. 실제로 기기 간 통신을 하려면 다음 기술 스택 중 하나를 추가해야 합니다:

- **Firebase (Realtime Database)**: 가장 쉬운 방법. `MOCK_DEVICES` 로직을 Firebase 리스너로 교체하면 됩니다.
- **WebRTC (PeerJS)**: 서버를 거치지 않고 기기 간 직접 파일 전송을 하려면 PeerJS를 사용하세요.

## 기술 스택
- **Frontend**: React, Tailwind CSS, Lucide Icons
- **AI**: Google Gemini API (`gemini-2.5-flash-image`, `gemini-3-flash-preview`)
- **Build**: Vite
