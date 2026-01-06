import React from 'react';
import { SharedItem, ContentType } from '../types';
import { FileText, Image as ImageIcon, Film, Monitor, Smartphone, Laptop, Download } from 'lucide-react';

interface Props {
  item: SharedItem;
}

export const FeedItemCard: React.FC<Props> = ({ item }) => {
  const getIcon = () => {
    switch (item.type) {
      case ContentType.TEXT: return <FileText className="w-5 h-5 text-blue-400" />;
      case ContentType.IMAGE: return <ImageIcon className="w-5 h-5 text-purple-400" />;
      case ContentType.VIDEO: return <Film className="w-5 h-5 text-rose-400" />;
    }
  };

  const getDeviceIcon = () => {
    // Determine icon based on simple string matching for demo
    if (item.sender.toLowerCase().includes('mobile') || item.sender.toLowerCase().includes('phone') || item.sender.includes('아이폰') || item.sender.includes('폰')) return <Smartphone className="w-3 h-3" />;
    if (item.sender.toLowerCase().includes('laptop') || item.sender.toLowerCase().includes('macbook') || item.sender.includes('맥북')) return <Laptop className="w-3 h-3" />;
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
      link.download = `syncflow_${item.id}.${ext}`;
    }

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="p-4 border-b border-slate-700/50 flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-700/50 rounded-lg">
            {getIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide font-semibold">
              {getTypeLabel(item.type)}
              <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
              <span className="flex items-center gap-1">
                {getDeviceIcon()}
                {item.sender}
              </span>
            </div>
            <div className="text-slate-500 text-[10px] mt-0.5">
              {new Date(item.timestamp).toLocaleTimeString('ko-KR')}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        {item.type === ContentType.TEXT && (
          <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">{item.content}</p>
        )}
        
        {item.type === ContentType.IMAGE && (
          <div className="relative group">
            <div className="rounded-lg overflow-hidden bg-slate-900 border border-slate-700">
              <img src={item.content} alt="Shared" className="w-full h-auto max-h-64 object-contain" />
            </div>
            <button
              onClick={handleDownload}
              className="absolute top-2 right-2 p-2 bg-slate-900/80 hover:bg-blue-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"
              title="다운로드"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        )}

        {item.type === ContentType.VIDEO && (
          <div className="relative group">
            <div className="rounded-lg overflow-hidden bg-slate-900 border border-slate-700">
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
              <p className="text-xs text-slate-400">{item.fileName || '동영상 파일'}</p>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors"
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