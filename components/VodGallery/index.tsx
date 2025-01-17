import React, { useCallback, useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import ReactGA from 'react-ga';
import ErrorModal from '@/components/ErrorModal';
import { useGlobal } from '@/stores/GlobalContext';
import VodModal from '@/components/VodModal';

import { StreamerInformation, Container, Image } from './styles';
import Link from 'next/link';
import api from '@/utils/services/api';

interface ResultProps {
  _id: string;
  animated_preview_url: string;
  preview: {
    large: string;
  };
  broadcast_id: number;
  title: string;
  views: number;
  url: string;
  length: number; //in seconds
  game: string;
  channel: {
    display_name: string;
    logo: string;
    description: string;
    url: string;
    name: string;
  };
  recorded_at: string;
}

export const formatNumber = (num: number) => {
  if (num > 1000 && num < 1000000) {
    return (num / 1000).toString().slice(0, 3) + 'K';
  } else if (num > 1000000) {
    return (num / 1000000).toString().slice(0, 3) + 'M';
  } else {
    return num;
  }
};

const VodGallery = ({ data }: any) => {
  const [videos, setVideos] = useState(data);
  const { vodUrl, setVodUrl, videoQuality } = useGlobal();
  const streamerInformation: ResultProps['channel'] = data[0].channel;
  const [offset, setOffset] = useState(0);
  const [totalVideos, setTotalVideos] = useState(50);
  data[0].channel._id !== videos[0].channel._id && setVideos(data);
  useEffect(() => {
    ReactGA.initialize(`${process.env.NEXT_PUBLIC_GOOGLE_TRACKING}`, {
      testMode: process.env.NODE_ENV === 'test',
    });
  }, []);

  const [error, setError] = useState(false);

  const handleVideo = async (result: any) => {
    const splitString = await result.animated_preview_url.match(
      /^https?:\/\/(?:[\w\.\/]+)\/(.+)\/storyboards/,
    );
    const hostUrl = await result.animated_preview_url.split('/')[2];

    let dataUrl = `${process.env.NEXT_PUBLIC_CORS}https://${hostUrl}/${splitString[1]}/${videoQuality}/index-dvr.m3u8`;
    let dataUrlUpload = `${process.env.NEXT_PUBLIC_CORS}https://${hostUrl}/${
      streamerInformation.name
    }/${result._id.replace('v', '')}/${splitString[1]}/${
      videoQuality === 'chunked' ? '1080p60' : videoQuality
    }/index-dvr.m3u8`;

    try {
      if (result.broadcast_type === 'upload') {
        setVodUrl(dataUrlUpload);
        return;
      }

      const checkIfVideoExists = await axios.head(`${dataUrl}`);
      if (checkIfVideoExists.status !== 403) {
        setVodUrl(result.broadcast_id !== 1 ? dataUrl : result.url);
      } else {
        setError(true);
      }
    } catch (err) {
      setError(true);
      throw new Error(err);
    }

    window.scrollTo({ behavior: 'smooth', top: 340 });

    ReactGA.event({
      category: 'SearchedUserForDeletedVod',
      action: `${splitString[1]}`,
    });
  };

  const timeToHMS = (s: number) => {
    const h = Math.floor(s / 3600);
    s -= h * 3600;
    const m = Math.floor(s / 60);
    s -= m * 60;

    return `${h}:${m > 10 ? m : '0' + m}:${s > 10 ? s : '0' + s}`;
  };

  const handlePagination = useCallback(
    ({ next }) => {
      setError(false);
      api
        .get(
          `channels/${data[0].channel._id}/videos?limit=9&offset=${
            next ? offset + 9 : offset - 9
          }`,
        )
        .then((channelResponse: any) => {
          if (channelResponse.data.videos.length !== 0) {
            setTotalVideos(channelResponse.data._total);
            setVideos(channelResponse.data.videos);
            next ? setOffset(offset + 9) : setOffset(offset - 9);
            window.scrollTo({ behavior: 'smooth', top: 340 });
          }
        })
        .catch((err) => {
          setError(true);
          throw new Error(err);
        });
    },
    [offset, data],
  );

  const renderVideos = useMemo(() => {
    return videos.map((result: ResultProps) => {
      return (
        <div key={result._id} title={result.title} className="stream">
          <button type="button" onClick={() => handleVideo(result)}>
            <div>
              <Image
                url={result.preview.large}
                animated={result.animated_preview_url}
              >
                <span>{timeToHMS(result.length)}</span>
              </Image>
            </div>
            <strong>{result.title}</strong>
            <span>
              <p>Views: {formatNumber(result.views)}</p>
              <p>{new Date(result.recorded_at).toLocaleDateString()}</p>
            </span>
          </button>
        </div>
      );
    });
  }, [videos]);

  return (
    <>
      {data && !error && (
        <Link href={streamerInformation.url}>
          <a target="_blank" rel="noopener noreferrer">
            <StreamerInformation>
              <div title={streamerInformation.description}>
                <img
                  src={streamerInformation.logo.replace('300x300', '150x150')}
                  alt={streamerInformation.display_name}
                />
              </div>
              <div>
                <h1>{streamerInformation.display_name}</h1>
                <p>{streamerInformation.description}</p>
              </div>
            </StreamerInformation>
          </a>
        </Link>
      )}
      {vodUrl && (
        <>
          <VodModal videoUrl={vodUrl} />
          <a
            href="https://ko-fi.com/pogulive"
            target="_blank"
            rel="noopener noreferrer"
          >
            Help me keep the servers running
            <img
              className="kofi-img"
              width="230px"
              src="https://cdn.ko-fi.com/cdn/kofi5.png?v=2"
              alt="Buy Me a Coffee at ko-fi.com"
            />
          </a>
        </>
      )}
      {error && !vodUrl && videoQuality === 'chunked' && (
        <ErrorModal message="We couldn't find this video" />
      )}
      {error && !vodUrl && videoQuality !== 'chunked' && (
        <ErrorModal message="We couldn't find this video, try changing the quality to 'Source'" />
      )}

      <Container>
        {renderVideos}
        <div className="pagination-button-container">
          {offset > 0 && (
            <button
              className="pagination-button"
              type="button"
              onClick={() => handlePagination({ next: false })}
            >
              previous page
            </button>
          )}
          {offset + 9 < totalVideos && (
            <button
              className="pagination-button"
              type="button"
              onClick={() => handlePagination({ next: true })}
            >
              next page
            </button>
          )}
        </div>
      </Container>
    </>
  );
};

export default VodGallery;
