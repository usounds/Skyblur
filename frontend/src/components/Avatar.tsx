
import { AppBskyActorDefs } from '@atcute/bluesky';
import Image from 'next/image';
import Link from 'next/link';
import { RxAvatar } from "react-icons/rx";

type AvatarProp = {
    userProf: AppBskyActorDefs.ProfileViewDetailed
    href: string
    target:string
};

export const Avatar: React.FC<AvatarProp> = ({
    userProf,
    href,
    target
}) => {
    return (

        <Link className="flex items-center gap-x-2 mb-3" href={href||''} target={target||''}>
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
                <RxAvatar size={48} />
            )}

            <div>
                <h1 className="text-lg font-semibold">{userProf.displayName || "No Display Name"}</h1>

                <p className="text-sm text-gray-500 ">@{userProf.handle}</p>
            </div>
        </Link>
    );
};

