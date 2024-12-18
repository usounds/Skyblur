
import type { AppBskyActorDefs as AtCuteAppBskyActorDefs, } from '@atcute/client/lexicons';
import Image from 'next/image';

type AvatarProp = {
    userProf: AtCuteAppBskyActorDefs.ProfileViewDetailed
    time?: string
};

export const Avatar: React.FC<AvatarProp> = ({
    userProf,

}) => {
    return (

        <a className="flex items-center gap-x-2 mb-3" href={"https://bsky.app/profile/" + userProf.handle} target="_blank">
            {userProf.avatar ? (
                <Image
                    className="object-cover w-10 h-10 rounded-full"
                    width={48}
                    height={48}
                    src={userProf.avatar}
                    alt={userProf.displayName || "No Avatar"}
                    unoptimized
                />
            ) : (
                <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="none"
                    data-testid="userAvatarFallback"
                >
                    <circle cx="12" cy="12" r="12" fill="#0070ff"></circle>
                    <circle cx="12" cy="9.5" r="3.5" fill="#fff"></circle>
                    <path
                        fill="#fff"
                        d="M 12.058 22.784 C 9.422 22.784 7.007 21.836 5.137 20.262 C 5.667 17.988 8.534 16.25 11.99 16.25 C 15.494 16.25 18.391 18.036 18.864 20.357 C 17.01 21.874 14.64 22.784 12.058 22.784 Z"
                    ></path>
                </svg>
            )}

            <div>
                <h1 className="text-lg font-semibold">{userProf.displayName || "No Display Name"}</h1>

                <p className="text-sm text-gray-500 ">@{userProf.handle}</p>
            </div>
        </a>
    );
};

