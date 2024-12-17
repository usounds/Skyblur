"use client"
export const runtime = 'edge';
import { Avatar } from "@/components/Avatar";
import Header from "@/components/Header";
import PostLoading from "@/components/PostLoading";
import PostTextWithBold from "@/components/PostTextWithBold";
import { fetchServiceEndpoint } from "@/logic/HandleGetBlurRecord";
import { formatDateToLocale } from "@/logic/LocaledDatetime";
import { useAtpAgentStore } from "@/state/AtpAgent";
import { useLocaleStore } from "@/state/Locale";
import { COLLECTION, PostData, customTheme } from '@/types/types';
import { AppBskyActorDefs, AtpAgent } from '@atproto/api';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Button, ThemeProvider, extendTheme, theme, Divider } from 'reablocks';
import { useEffect, useState } from "react";

const PostPage = () => {
  const { did, rkey } = useParams();
  const [isLoading, setIsLoading] = useState<boolean>(true)
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

  const aturi = 'at://' + did + "/" + COLLECTION + "/" + rkey

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
            service: pdsUrl || ''
          })

          try {
            // getProfileとgetRecordを並行して呼び出す
            const [userProfileResponse, postResponse] = await Promise.all([
              apiAgent.getProfile({ actor: repo }),
              pdsAgent.com.atproto.repo.getRecord({
                repo: repo,
                collection: COLLECTION,
                rkey: rkeyParam,
              }),
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


  return (
    <>
      <Header />
      <link rel="alternate" href={aturi} />

      <ThemeProvider theme={extendTheme(theme, customTheme)}>
        <div className="mx-auto max-w-screen-sm px-4 md:px-8 mt-8 text-gray-800">
          <div className="mx-auto rounded-lg">
            {userProf &&
              <Avatar userProf={userProf} />
            }

            {isLoading ?
              <div className="">
                <PostLoading />
              </div>
              :
              <>
                {!errorMessage &&
                  <>
                    <div className="border rounded-lg p-2 border-gray-300 max-w-screen-sm">
                      <div className="overflow-hidden break-words">
                        <PostTextWithBold postText={postText} isValidateBrackets={true} />
                      </div>
                      {addText &&
                        <div className="">
                          <Divider  variant="secondary"  />
                          <PostTextWithBold postText={addText} isValidateBrackets={false} />
                        </div>
                      }

                      <div className="flex justify-between items-center mt-2">
                        <div className="text-sm text-gray-400">{postDate}</div>
                        <div className="flex gap-2">
                          <a className="text-sm text-gray-500 mx-2" href={bskyUrl} target="_blank">
                            <Image
                              src="https://backet.skyblur.uk/bluesky-brands-solid.svg" // public フォルダ内のファイルは / からの相対パスで指定
                              alt="Trash Icon"
                              width={20} // 必要に応じて幅を指定
                              height={20} // 必要に応じて高さを指定
                            />
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
