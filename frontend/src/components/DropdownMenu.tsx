import { useLocaleStore } from "@/state/Locale";
import { PostListItem, SKYBLUR_POST_COLLECTION, VISIBILITY_PASSWORD, VISIBILITY_PUBLIC } from "@/types/types";
import { Client } from '@atcute/client';
import { ActorIdentifier } from '@atcute/lexicons/syntax';
import { Button, Group, Menu, Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useState } from "react";
import { BsThreeDots } from "react-icons/bs";
import { GrEdit } from "react-icons/gr";
import { HiCheck, HiX } from "react-icons/hi";
import { LuClipboardCheck, LuTrash2 } from "react-icons/lu";

type DropsownMenuProps = {
    handleEdit: ((input: PostListItem) => void) | null;
    post: PostListItem;
    setDeleteList: React.Dispatch<React.SetStateAction<PostListItem[]>>;
    agent: Client;
    did: string;
};

function DropdownMenu({ post, handleEdit, agent, did, setDeleteList }: DropsownMenuProps) {
    const locale = useLocaleStore((state) => state.localeData);
    const [opened, { open, close }] = useDisclosure(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleCopyToClipboard = async (item: PostListItem) => {
        console.log('handleCopyToClipboard')
        try {
            if (item.blurURL) {
                notifications.show({
                    title: 'Success',
                    message: locale.DeleteList_URLCopy,
                    color: 'teal',
                    icon: <HiCheck />
                });
                await navigator.clipboard.writeText(item.blurURL);
            } else {
                console.error('URLが無効です');
            }
        } catch (error) {
            console.error('クリップボードへのコピーに失敗しました', error);
        }
    };

    const handleDeleteItem = async () => {
        setIsDeleting(true)
        notifications.show({
            id: 'Delete-process',
            title: locale.DeleteList_DeleteButton,
            message: locale.DeleteList_DeleteInProgress,
            loading: true,
            autoClose: false
        });
        try {
            const writes: {
                $type: 'com.atproto.repo.applyWrites#delete';
                collection: 'app.bsky.feed.post'; // ここは具体的な型と一致させる
                rkey: string;
            }[] = [];

            writes.push({
                $type: 'com.atproto.repo.applyWrites#delete',
                collection: 'app.bsky.feed.post',
                rkey: post?.blur.uri.split('/').pop() || '',
            });

            await agent.post('com.atproto.repo.applyWrites', {
                input: {
                    repo: did as ActorIdentifier,
                    writes,
                },
            });
        } catch (e) {
            //　握りつぶす
            console.error("エラーが発生しました:", e);
        }

        try {
            const writes: {
                $type: 'com.atproto.repo.applyWrites#delete';
                collection: 'uk.skyblur.post'; // ここは具体的な型と一致させる
                rkey: string;
            }[] = [];

            writes.push({
                $type: 'com.atproto.repo.applyWrites#delete',
                collection: SKYBLUR_POST_COLLECTION,
                rkey: post?.blurATUri.split('/').pop() || '',
            });

            await agent.post('com.atproto.repo.applyWrites', {
                input: {
                    repo: did as ActorIdentifier,
                    writes,
                },
            });
        } catch (e) {
            // エラーハンドリング
            console.error("エラーが発生しました:", e);
            notifications.update({
                id: 'Delete-process',
                title: 'Error',
                message: 'Error:' + e,
                color: 'teal',
                icon: <HiX />,
                loading: false,
                autoClose: true
            });
            close();
            setIsDeleting(false)
            return
        }

        notifications.update({
            id: 'Delete-process',
            title: 'Success',
            message: locale.DeleteList_Complete,
            color: 'teal',
            icon: <HiCheck />,
            loading: false,
            autoClose: true
        });

        setIsDeleting(false)
        close();
        setDeleteList(prev => prev.filter(item => item !== post));

    };

    return (

        <Menu shadow="md" width={200} >
            <Modal opened={opened} onClose={close} title={locale.DeleteList_ConfirmDelete} centered>
                {post.blur.text}
                <Group mt="md" style={{ justifyContent: 'flex-end' }}>
                    <Button variant="default" color="gray" onClick={close}>
                        {locale.DeleteList_CancelButton}
                    </Button>
                    <Button variant="filled" color="red" onClick={handleDeleteItem} loading={isDeleting} loaderProps={{ type: 'dots' }}>

                        {locale.DeleteList_DeleteButton}
                    </Button>
                </Group>
            </Modal>
            <Menu.Target>
                <BsThreeDots size={24} />
            </Menu.Target>

            <Menu.Dropdown>
                <Menu.Label>Menu</Menu.Label>
                {((post.blur.visibility === VISIBILITY_PASSWORD && post.isDecrypt) || post.blur.visibility === VISIBILITY_PUBLIC) &&
                    <Menu.Item leftSection={<GrEdit size={18} />} onClick={() => handleEdit && handleEdit(post)}>{locale.DeleteList_Edit}</Menu.Item>
                }
                <Menu.Item
                    leftSection={<LuClipboardCheck size={18} />}
                    onClick={() => handleCopyToClipboard(post)}
                >
                    {locale.DeleteList_CopySkylurURL}
                </Menu.Item>

                <Menu.Item
                    component="a"
                    href={post.postURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    leftSection={
                        <svg width="18" height="18" viewBox="0 0 1452 1452" xmlns="http://www.w3.org/2000/svg">
                            <path d="M725.669,684.169c85.954,-174.908 196.522,-329.297 331.704,-463.171c45.917,-43.253 98.131,-74.732 156.638,-94.443c80.779,-23.002 127.157,10.154 139.131,99.467c-2.122,144.025 -12.566,287.365 -31.327,430.015c-29.111,113.446 -96.987,180.762 -203.629,201.947c-36.024,5.837 -72.266,8.516 -108.726,8.038c49.745,11.389 95.815,32.154 138.21,62.292c77.217,64.765 90.425,142.799 39.62,234.097c-37.567,57.717 -83.945,104.938 -139.131,141.664c-82.806,48.116 -154.983,33.716 -216.529,-43.202c-28.935,-38.951 -52.278,-81.818 -70.026,-128.603c-12.177,-34.148 -24.156,-68.309 -35.935,-102.481c-11.779,34.172 -23.757,68.333 -35.934,102.481c-17.748,46.785 -41.091,89.652 -70.027,128.603c-61.545,76.918 -133.722,91.318 -216.529,43.202c-55.186,-36.726 -101.564,-83.947 -139.131,-141.664c-50.804,-91.298 -37.597,-169.332 39.62,-234.097c42.396,-30.138 88.466,-50.903 138.21,-62.292c-36.46,0.478 -72.702,-2.201 -108.725,-8.038c-106.643,-21.185 -174.519,-88.501 -203.629,-201.947c-18.762,-142.65 -29.205,-285.99 -31.328,-430.015c11.975,-89.313 58.352,-122.469 139.132,-99.467c58.507,19.711 110.72,51.19 156.637,94.443c135.183,133.874 245.751,288.263 331.704,463.171Z" fill="currentColor" />
                        </svg>
                    }
                >
                    {locale.DeleteList_ViewBskyPost}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color='red' onClick={open} leftSection={<LuTrash2 size={18} />}>{locale.DeleteList_DeleteButton}</Menu.Item>
            </Menu.Dropdown>

        </Menu>
    );
}

export default DropdownMenu;
