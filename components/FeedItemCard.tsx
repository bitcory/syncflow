import React, { useState } from 'react';
import { SharedItem, ContentType } from '../types';
import { FileText, Image as ImageIcon, Film, Monitor, Smartphone, Laptop, Download, Copy, Check } from 'lucide-react';

interface Props {
  item: SharedItem;
}

export const FeedItemCard: React.FC<Props> = ({ item }) => {
  const [copied, setCopied] = useState(false);

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

  const getIcon = () => {
    switch (item.type) {
      case ContentType.TEXT: return <FileText className="w-5 h-5" />;
      case ContentType.IMAGE: return <ImageIcon className="w-5 h-5" />;
      case ContentType.VIDEO: return <Film className="w-5 h-5" />;
    }
  };

  const getTypeColor = () => {
    switch (item.type) {
      case ContentType.TEXT: return 'bg-[#FFE66D]';
      case ContentType.IMAGE: return 'bg-[#4ECDC4]';
      case ContentType.VIDEO: return 'bg-[#FF6B6B]';
    }
  };

  const getDeviceIcon = () => {
    if (item.sender.toLowerCase().includes('mobile') || item.sender.toLowerCase().includes('phone') || item.sender.includes('아이폰') || item.sender.includes('폰') || item.sender.includes('스마트폰')) return <Smartphone className="w-3 h-3" />;
    if (item.sender.toLowerCase().includes('laptop') || item.sender.toLowerCase().includes('macbook') || item.sender.includes('맥북') || item.sender.includes('노트북')) return <Laptop className="w-3 h-3" />;
    return <Monitor className="w-3 h-3" />;
  };

  const getTypeLabel = (type: ContentType) => {
    switch (type) {
        case ContentType.TEXT: return '텍스트';
        case ContentType.IMAGE: return '이미지';
        case ContentType.VIDEO: return '동영상';
        default: return type;
    }
  }

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
  }

  return (
    <div
      className="bg-white border-3 border-gray-900 overflow-hidden transition-all hover:-translate-y-1"
      style={{border: '3px solid #1a1a2e', boxShadow: '5px 5px 0px #1a1a2e'}}
    >
      <div className={`p-4 border-b-3 border-gray-900 flex justify-between items-start ${getTypeColor()}`} style={{borderBottom: '3px solid #1a1a2e'}}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white border-2 border-gray-900">
            {getIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-900 uppercase tracking-wide font-bold">
              {getTypeLabel(item.type)}
              <span className="w-1.5 h-1.5 bg-gray-900 rounded-full"></span>
              <span className="flex items-center gap-1">
                {getDeviceIcon()}
                {item.sender}
              </span>
            </div>
            <div className="text-gray-700 text-[10px] mt-0.5 font-medium">
              {new Date(item.timestamp).toLocaleTimeString('ko-KR')}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        {item.type === ContentType.TEXT && (
          <div className="relative group">
            <p className="text-gray-900 text-sm whitespace-pre-wrap leading-relaxed font-medium pr-10">{item.content}</p>
            <button
              onClick={handleCopy}
              className={`absolute top-0 right-0 p-2 ${copied ? 'bg-[#4ECDC4]' : 'bg-[#FFE66D] hover:bg-[#4ECDC4]'} text-gray-900 border-2 border-gray-900 transition-all`}
              title={copied ? '복사됨!' : '복사'}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}

        {item.type === ContentType.IMAGE && (
          <div className="relative group">
            <div className="border-2 border-gray-900 overflow-hidden bg-gray-100">
              <img src={item.content} alt="Shared" className="w-full h-auto max-h-64 object-contain" />
            </div>
            <button
              onClick={handleDownload}
              className="absolute top-2 right-2 p-2 bg-[#FFE66D] hover:bg-[#4ECDC4] text-gray-900 border-2 border-gray-900 opacity-0 group-hover:opacity-100 transition-all"
              title="다운로드"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        )}

        {item.type === ContentType.VIDEO && (
          <div className="relative group">
            <div className="border-2 border-gray-900 overflow-hidden bg-gray-100">
              <video
                src={item.content}
                controls
                className="w-full h-auto max-h-64"
                playsInline
              >
                동영상을 재생할 수 없습니다.
              </video>
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <p className="text-xs text-gray-700 font-medium">{item.fileName || '동영상 파일'}</p>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4ECDC4] hover:bg-[#FFE66D] text-gray-900 text-xs font-bold border-2 border-gray-900 transition-colors"
              >
                <Download className="w-3 h-3" />
                다운로드
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
