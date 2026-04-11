"use client";

import { useState } from "react";

import {
  FEED_COMPOSER_SPECS,
  type FeedComposerPostType,
} from "@/lib/feedComposerConfig";

import { CuratedImageUploadField } from "./CuratedImageUploadField";

export function FeedComposerMediaFieldset() {
  const [postType, setPostType] = useState<FeedComposerPostType>("standard");
  const spec = FEED_COMPOSER_SPECS[postType];

  return (
    <>
      <div className="field">
        <label htmlFor="feed-type">Formato do post</label>
        <select
          id="feed-type"
          name="postType"
          value={postType}
          onChange={(event) =>
            setPostType(event.target.value as FeedComposerPostType)
          }
        >
          <option value="standard">Foto ou galeria</option>
          <option value="before_after">Antes e depois</option>
          <option value="reel">Vídeo curto</option>
        </select>
      </div>

      <div className="feed-composer-format-panel">
        <div className="feed-composer-format-panel__header">
          <strong>{spec.title}</strong>
          <p>{spec.summary}</p>
        </div>

        <div className="feed-composer-format-panel__chips">
          {spec.visualNotes.map((note) => (
            <span key={note}>{note}</span>
          ))}
        </div>

        <div className="feed-composer-format-panel__rules">
          {spec.imageRules.map((rule) => (
            <div key={rule} className="feed-composer-format-panel__rule">
              {rule}
            </div>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="feed-images">{spec.imageFieldLabel}</label>
        <CuratedImageUploadField
          id="feed-images"
          name="images"
          context="feed"
          multiple={postType !== "reel"}
          required
          helperText={spec.imageHelper}
        />
        <small className="muted">{spec.imageHelper}</small>
      </div>

      <div className="field">
        <label htmlFor="feed-video">Vídeo curto</label>
        <input
          id="feed-video"
          name="video"
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          required={spec.videoRequired}
          disabled={!spec.videoEnabled}
        />
        <small className="muted">{spec.videoHelper}</small>
      </div>
    </>
  );
}
