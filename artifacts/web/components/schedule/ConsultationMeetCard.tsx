"use client";

import { Video, ExternalLink, AlertTriangle } from "lucide-react";

interface Props {
  joinUrl: string;
  allChecked: boolean;
}

export function ConsultationMeetCard({ joinUrl, allChecked }: Props) {
  return (
    <div className="bg-surface rounded-xl border border-bdr p-4">
      <div className="flex items-center gap-2 mb-3">
        <Video className="w-4 h-4 text-brand" />
        <h3 className="text-sm font-semibold text-t1">Video Consultation</h3>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-t2">
            Platform: <span className="font-medium text-t1">Google Meet</span>
          </p>
          <p className="text-xs text-t2 mt-0.5">
            Recording: <span className="font-medium text-err">Disabled (DEC-40)</span>
          </p>
          <p className="text-xs text-t2 mt-0.5">
            Transcription: <span className="font-medium text-err">Disabled (DEC-40)</span>
          </p>
        </div>

        <a
          href={joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            allChecked
              ? "bg-ok text-white hover:bg-ok/90"
              : "bg-slate-100 text-t3 cursor-not-allowed"
          }`}
          onClick={(e) => !allChecked && e.preventDefault()}
          title={!allChecked ? "Complete identity verification first" : ""}
        >
          <Video className="w-4 h-4" />
          Join call
          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
        </a>
      </div>

      {!allChecked && (
        <p className="text-xs text-warn mt-3 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          Complete identity verification above before joining
        </p>
      )}
    </div>
  );
}
