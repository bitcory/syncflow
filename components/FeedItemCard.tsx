import React, { useState } from 'react';
import { SharedItem, ContentType } from '../types';
import { ChevronDown } from 'lucide-react';

interface Props {
  item: SharedItem;
  currentUserId?: number;
  currentUserName?: string;
  onSelect?: () => void;
  isSelected?: boolean;
}

const MAX_LENGTH = 200; // 최대 표시 글자 수

export const FeedItemCard: React.FC<Props> = ({ item, currentUserId, currentUserName, onSelect, isSelected }) => {
  const [expanded, setExpanded] = useState(false);

  // 내 메시지인지 확인 (senderId 비교 또는 이름 비교)
  const isMine = (
    (currentUserId && (item.senderId === currentUserId || Number(item.senderId) === currentUserId)) ||
    (currentUserName && item.sender === currentUserName)
  );

  // 긴 텍스트인지 확인
  const isLongText = item.type === ContentType.TEXT && item.content.length > MAX_LENGTH;

  // 표시할 텍스트
  const displayText = isLongText && !expanded
    ? item.content.slice(0, MAX_LENGTH) + '...'
    : item.content;

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(true);
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

            <div
                 onClick={onSelect}
                 className={`bg-[#FFE66D] border-2 border-gray-900 rounded-2xl rounded-tr-none max-w-[280px] md:max-w-[400px] overflow-hidden cursor-pointer transition-all ${isSelected ? 'ring-2 ring-[#4ECDC4] ring-offset-2' : 'hover:shadow-[4px_4px_0px_#1a1a2e]'}`}
                 style={{boxShadow: '2px 2px 0px #1a1a2e'}}>

              {/* 텍스트 메시지 */}
              {item.type === ContentType.TEXT && (
                <div className="p-3">
                  <p className="text-gray-900 text-sm whitespace-pre-wrap leading-relaxed">
                    {displayText}
                  </p>
                  {isLongText && !expanded && (
                    <button
                      onClick={handleExpand}
                      className="flex items-center justify-center w-full mt-2 text-gray-700 hover:text-gray-900"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* 이미지 메시지 - 썸네일 우선 표시 */}
              {item.type === ContentType.IMAGE && (
                <img
                  src={item.thumbnailUrl || item.content}
                  alt="Shared"
                  className="max-w-full h-auto max-h-72 object-contain"
                />
              )}

              {/* 동영상 메시지 */}
              {item.type === ContentType.VIDEO && (
                <video
                  src={item.content}
                  className="max-w-full h-auto max-h-72"
                  playsInline
                  muted
                >
                  동영상을 재생할 수 없습니다.
                </video>
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
          <div
               onClick={onSelect}
               className={`bg-white border-2 border-gray-900 rounded-2xl rounded-tl-none max-w-[280px] md:max-w-[400px] overflow-hidden cursor-pointer transition-all ${isSelected ? 'ring-2 ring-[#4ECDC4] ring-offset-2' : 'hover:shadow-[4px_4px_0px_#1a1a2e]'}`}
               style={{boxShadow: '2px 2px 0px #1a1a2e'}}>

            {/* 텍스트 메시지 */}
            {item.type === ContentType.TEXT && (
              <div className="p-3">
                <p className="text-gray-900 text-sm whitespace-pre-wrap leading-relaxed">
                  {displayText}
                </p>
                {isLongText && !expanded && (
                  <button
                    onClick={handleExpand}
                    className="flex items-center justify-center w-full mt-2 text-gray-700 hover:text-gray-900"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* 이미지 메시지 - 썸네일 우선 표시 */}
            {item.type === ContentType.IMAGE && (
              <img
                src={item.thumbnailUrl || item.content}
                alt="Shared"
                className="max-w-full h-auto max-h-72 object-contain"
              />
            )}

            {/* 동영상 메시지 */}
            {item.type === ContentType.VIDEO && (
              <video
                src={item.content}
                className="max-w-full h-auto max-h-72"
                playsInline
                muted
              >
                동영상을 재생할 수 없습니다.
              </video>
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
