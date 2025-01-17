"use client"
export const runtime = 'edge';
import { Avatar } from "@/components/Avatar";
import Header from "@/components/Header";
import PostLoading from "@/components/PostLoading";
import PostTextWithBold from "@/components/PostTextWithBold";
import { fetchServiceEndpoint, getPreference } from "@/logic/HandleBluesky";
import { formatDateToLocale } from "@/logic/LocaledDatetime";
import { useAtpAgentStore } from "@/state/AtpAgent";
import { useLocaleStore } from "@/state/Locale";
import { POST_COLLECTION, PostData, customTheme } from '@/types/types';
import { AppBskyActorDefs, AtpAgent } from '@atproto/api';
import Head from 'next/head';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Button, Divider, ThemeProvider, extendTheme, theme } from 'reablocks';
import { useEffect, useState } from "react";

const PostPage = () => {
  const { did, rkey } = useParams();
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isMyPage, setIsMyPage] = useState<boolean>(false)
  const [postText, setPostText] = useState<string>('')
  const [addText, setAddText] = useState("");
  const [bskyUrl, setBskyUrl] = useState("");
  const [postDate, setPostDate] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [userProf, setUserProf] = useState<AppBskyActorDefs.ProfileViewDetailed>()
  const locale = useLocaleStore((state) => state.localeData);
  const apiAgent = useAtpAgentStore((state) => state.publicAgent);
  const searchParams = useSearchParams();
  const agent = useAtpAgentStore((state) => state.agent);
  const q = searchParams.get('q');
  const aturi = 'at://' + did + "/" + POST_COLLECTION + "/" + rkey

  useEffect(() => {
    if (did && rkey) {


      const fetchRecord = async () => {

        try {
          let repo = Array.isArray(did) ? did[0] : did; // 配列なら最初の要素を使う
          repo = repo.replace(/%3A/g, ':');
          const rkeyParam = Array.isArray(rkey) ? rkey[0] : rkey; // 配列なら最初の要素を使う
          setIsLoading(true);
          setErrorMessage('')

          const pdsUrl = await fetchServiceEndpoint(repo)

          const pdsAgent = new AtpAgent({
            service:pdsUrl||''
          })

          try {
            // getProfileとgetRecordを並行して呼び出す
            const [userProfileResponse, postResponse] = await Promise.all([
              apiAgent.getProfile({ actor: repo }),
              getPostResponse(repo, rkeyParam, pdsAgent),
              getPreferenceProcess(repo, pdsAgent)
            ]);

            // userProfileのデータをセット
            setUserProf(userProfileResponse.data);

            // postDataのデータをセット
            const postData: PostData = postResponse.data.value as PostData;

            const tempPostText = postData.text

            //if(validateBrackets(postData.text)) tempPostText = tempPostText.replace(/[\[\]]/g, '')

            setPostText(tempPostText);
            setAddText(postData.additional);
            setPostDate(formatDateToLocale(postData.createdAt));

            const convertedUri = postData.uri.replace('at://did:', 'https://bsky.app/profile/did:').replace('/app.bsky.feed.post/', '/post/');
            setBskyUrl(convertedUri)
            setIsLoading(false); // ローディング状態を終了

          } catch (err) {
            // エラーハンドリング
            setErrorMessage(err + '');
            setIsLoading(false); // ローディング状態を終了
          }
        } catch (err) {
          setErrorMessage(err + '');
        } finally {
          setIsLoading(false);
        }
      };

      fetchRecord();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [did, rkey]); // did または rkey が変更された場合に再実行


  async function getPreferenceProcess(repo: string,pdsAgent:AtpAgent) {
    try {
      const preference = await getPreference(pdsAgent, repo)
      if (preference.myPage.isUseMyPage) setIsMyPage(true)
    } catch (e) {

    }
  }

  async function getPostResponse(repo: string, rkey: string,pdsAgent:AtpAgent) {


    try {
      return pdsAgent.com.atproto.repo.getRecord({
        repo: repo,
        collection: POST_COLLECTION,
        rkey: rkey,
      })


    } catch (e) {

      return pdsAgent.com.atproto.repo.getRecord({
        repo: repo,
        collection: POST_COLLECTION,
        rkey: rkey,
      })

    }
  }

  return (
    <>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Header />
      <link rel="alternate" href={aturi} />

      <ThemeProvider theme={extendTheme(theme, customTheme)}>
        <div className="mx-auto max-w-screen-sm md:mt-6 mt-3 mx-2 text-gray-800">
          <div className="mx-auto rounded-lg">
            {userProf &&
              <div className="mb-2 mx-2">
                <Avatar userProf={userProf} href={isMyPage ? `https://${window.location.hostname}/profile/${userProf.did}` : `https://bsky.app/profile/${userProf.did}`} target={isMyPage ? `` : `_blank`} />
              </div>
            }

            {isLoading ?
              <div className="">
                <PostLoading />
              </div>
              :
              <>
                {!errorMessage &&
                  <>
                    <div className="border rounded-lg p-2 mx-2 border-gray-300 max-w-screen-sm">
                      <div className="overflow-hidden break-words">
                        <PostTextWithBold postText={postText} isValidateBrackets={true} isMask={null} />
                      </div>
                      {addText &&
                        <div className="">
                          <Divider variant="secondary" />
                          <PostTextWithBold postText={addText} isValidateBrackets={false} isMask={null} />
                        </div>
                      }

                      <div className="flex justify-between items-center mt-2">
                        <div className="text-sm text-gray-400">{postDate}</div>
                        <div className="flex">
                          <a className="text-sm text-gray-500" href={bskyUrl} target="_blank">

                            <svg width="22" height="22" viewBox="0 0 1452 1452" xmlns="http://www.w3.org/2000/svg"><path d="M725.669,684.169c85.954,-174.908 196.522,-329.297 331.704,-463.171c45.917,-43.253 98.131,-74.732 156.638,-94.443c80.779,-23.002 127.157,10.154 139.131,99.467c-2.122,144.025 -12.566,287.365 -31.327,430.015c-29.111,113.446 -96.987,180.762 -203.629,201.947c-36.024,5.837 -72.266,8.516 -108.726,8.038c49.745,11.389 95.815,32.154 138.21,62.292c77.217,64.765 90.425,142.799 39.62,234.097c-37.567,57.717 -83.945,104.938 -139.131,141.664c-82.806,48.116 -154.983,33.716 -216.529,-43.202c-28.935,-38.951 -52.278,-81.818 -70.026,-128.603c-12.177,-34.148 -24.156,-68.309 -35.935,-102.481c-11.779,34.172 -23.757,68.333 -35.934,102.481c-17.748,46.785 -41.091,89.652 -70.027,128.603c-61.545,76.918 -133.722,91.318 -216.529,43.202c-55.186,-36.726 -101.564,-83.947 -139.131,-141.664c-50.804,-91.298 -37.597,-169.332 39.62,-234.097c42.396,-30.138 88.466,-50.903 138.21,-62.292c-36.46,0.478 -72.702,-2.201 -108.725,-8.038c-106.643,-21.185 -174.519,-88.501 -203.629,-201.947c-18.762,-142.65 -29.205,-285.99 -31.328,-430.015c11.975,-89.313 58.352,-122.469 139.132,-99.467c58.507,19.711 110.72,51.19 156.637,94.443c135.183,133.874 245.751,288.263 331.704,463.171Z" fill="currentColor" /></svg>
                          </a>
                        </div>
                      </div>


                    </div>

                    {(q == 'preview' && agent) &&
                      <>
                        <div className="flex justify-center mt-10">
                          <Link href="/">
                            <Button color="secondary" size="large" className="text-white text-base font-normal" >{locale.Menu_Back}</Button>
                          </Link>
                        </div>
                      </>
                    }

                    {(q === null || q === '') && isMyPage && (
                      <>
                        <div className="flex justify-center mt-10">
                          <Link href={`/profile/${did}`}>
                            <Button color="secondary" size="large" className="text-white text-base font-normal" >{locale.Post_GoMyPage}</Button>
                          </Link>
                        </div>
                      </>
                    )
                    }

                  </>
                }
              </>
            }

            {errorMessage &&
              <div className="whitespace-pre-wrap break-words text-red-800">
                {errorMessage}
              </div>
            }
          </div>
        </div >
      </ThemeProvider>
    </>
  );
};

export default PostPage;
