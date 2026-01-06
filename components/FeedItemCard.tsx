import React, { useState } from 'react';
import { SharedItem, ContentType } from '../types';
import { Download, Copy, Check } from 'lucide-react';

interface Props {
  item: SharedItem;
  currentUserId?: number;
}

export const FeedItemCard: React.FC<Props> = ({ item, currentUserId }) => {
  const [copied, setCopied] = useState(false);

  // 내 메시지인지 확인
  const isMine = currentUserId && item.senderId === currentUserId;

  const decodeHtmlEntities = (text: string) => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  };

  const handleCopy = async () => {
    try {
      const decodedText = decodeHtmlEntities(item.content);
      await navigator.clipboard.writeText(decodedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('복사 실패:', err);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = item.content;

    if (item.fileName) {
      link.download = item.fileName;
    } else {
      const ext = item.type === ContentType.IMAGE ? 'png' : 'mp4';
      link.download = `tbchat_${item.id}.${ext}`;
    }

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 내 메시지 (오른쪽 정렬)
  if (isMine) {
    return (
      <div className="flex items-start gap-2 justify-end">
        <div className="flex flex-col items-end">
          {/* 메시지 버블 */}
          <div className="flex items-end gap-2">
            {/* 시간 */}
            <span className="text-[10px] text-gray-500 flex-shrink-0">
              {formatTime(item.timestamp)}
            </span>

            <div className="bg-[#FFE66D] border-2 border-gray-900 rounded-2xl rounded-tr-none max-w-[280px] md:max-w-[400px] overflow-hidden"
                 style={{boxShadow: '2px 2px 0px #1a1a2e'}}>

              {/* 텍스트 메시지 */}
              {item.type === ContentType.TEXT && (
                <div className="p-3 relative group">
                  <p className="text-gray-900 text-sm whitespace-pre-wrap leading-relaxed">
                    {item.content}
                  </p>
                  <button
                    onClick={handleCopy}
                    className={`absolute top-2 right-2 p-1.5 rounded-full ${copied ? 'bg-[#4ECDC4]' : 'bg-white/50 hover:bg-white'} text-gray-900 opacity-0 group-hover:opacity-100 transition-all`}
                    title={copied ? '복사됨!' : '복사'}
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              )}

              {/* 이미지 메시지 */}
              {item.type === ContentType.IMAGE && (
                <div className="relative group">
                  <img
                    src={item.content}
                    alt="Shared"
                    className="max-w-full h-auto max-h-72 object-contain"
                  />
                  <button
                    onClick={handleDownload}
                    className="absolute bottom-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"
                    title="다운로드"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* 동영상 메시지 */}
              {item.type === ContentType.VIDEO && (
                <div className="relative group">
                  <video
                    src={item.content}
                    controls
                    className="max-w-full h-auto max-h-72"
                    playsInline
                  >
                    동영상을 재생할 수 없습니다.
                  </video>
                  <button
                    onClick={handleDownload}
                    className="absolute bottom-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"
                    title="다운로드"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 다른 사람 메시지 (왼쪽 정렬)
  return (
    <div className="flex items-start gap-3">
      {/* 프로필 아바타 */}
      {item.senderImage ? (
        <img
          src={item.senderImage}
          alt={item.sender}
          className="w-10 h-10 rounded-full border-2 border-gray-900 flex-shrink-0 object-cover"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-[#4ECDC4] border-2 border-gray-900 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-gray-900">
            {item.sender.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        {/* 발신자 이름 */}
        <div className="text-xs font-bold text-gray-700 mb-1">
          {item.sender}
        </div>

        {/* 메시지 버블 */}
        <div className="flex items-end gap-2">
          <div className="bg-white border-2 border-gray-900 rounded-2xl rounded-tl-none max-w-[280px] md:max-w-[400px] overflow-hidden"
               style={{boxShadow: '2px 2px 0px #1a1a2e'}}>

            {/* 텍스트 메시지 */}
            {item.type === ContentType.TEXT && (
              <div className="p-3 relative group">
                <p className="text-gray-900 text-sm whitespace-pre-wrap leading-relaxed">
                  {item.content}
                </p>
                <button
                  onClick={handleCopy}
                  className={`absolute top-2 right-2 p-1.5 rounded-full ${copied ? 'bg-[#4ECDC4]' : 'bg-gray-100 hover:bg-[#FFE66D]'} text-gray-900 opacity-0 group-hover:opacity-100 transition-all`}
                  title={copied ? '복사됨!' : '복사'}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}

            {/* 이미지 메시지 */}
            {item.type === ContentType.IMAGE && (
              <div className="relative group">
                <img
                  src={item.content}
                  alt="Shared"
                  className="max-w-full h-auto max-h-72 object-contain"
                />
                <button
                  onClick={handleDownload}
                  className="absolute bottom-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"
                  title="다운로드"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* 동영상 메시지 */}
            {item.type === ContentType.VIDEO && (
              <div className="relative group">
                <video
                  src={item.content}
                  controls
                  className="max-w-full h-auto max-h-72"
                  playsInline
                >
                  동영상을 재생할 수 없습니다.
                </video>
                <button
                  onClick={handleDownload}
                  className="absolute bottom-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"
                  title="다운로드"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* 시간 */}
          <span className="text-[10px] text-gray-500 flex-shrink-0">
            {formatTime(item.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
};
