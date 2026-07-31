"use client";

import { useState } from "react";

import {
  FEED_COMPOSER_SPECS,
  type FeedComposerPostType,
} from "@/lib/feedComposerConfig";

import { CuratedImageUploadField } from "./CuratedImageUploadField";

type FeedComposerMediaFieldsetProps = {
  initialPostType?: FeedComposerPostType;
};

export function FeedComposerMediaFieldset({
  initialPostType = "standard",
}: FeedComposerMediaFieldsetProps) {
  const [postType, setPostType] = useState<FeedComposerPostType>(initialPostType);
  const spec = FEED_COMPOSER_SPECS[postType];
  const mediaContext = postType === "story" ? "story" : "feed";

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
          <option value="reel">Video curto</option>
          <option value="story">Story do salão</option>
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
          context={mediaContext}
          multiple={postType !== "reel" && postType !== "story"}
          required
          helperText={spec.imageHelper}
        />
        <small className="muted">{spec.imageHelper}</small>
      </div>

      {postType === "story" ? (
        <div className="field">
          <label htmlFor="feed-story-duration">Tempo de story</label>
          <select
            id="feed-story-duration"
            name="storyDurationHours"
            defaultValue="24"
          >
            <option value="12">12 horas</option>
            <option value="24">24 horas</option>
            <option value="48">48 horas</option>
          </select>
          <small className="muted">
            Depois desse prazo, o story sai sozinho do app do cliente.
          </small>
        </div>
      ) : null}

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
