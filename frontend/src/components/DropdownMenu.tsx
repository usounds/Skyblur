"use client"
import { useLocale } from "@/state/Locale";
import { PostListItem, SKYBLUR_POST_COLLECTION, VISIBILITY_LOGIN, VISIBILITY_PASSWORD, VISIBILITY_PUBLIC, VISIBILITY_FOLLOWERS, VISIBILITY_FOLLOWING, VISIBILITY_MUTUAL } from "@/types/types";
import { Client } from '@atcute/client';
import { ActorIdentifier, ResourceUri } from '@atcute/lexicons/syntax';
import { Button, Group, Menu, Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useState } from "react";
import { Ellipsis } from 'lucide-react';
import { SquarePen } from 'lucide-react';
import { Check, X } from 'lucide-react';
import { ClipboardCopy } from 'lucide-react';
import { Trash2 } from 'lucide-react';
import { BlueskyIcon } from './Icons';

type DropsownMenuProps = {
    handleEdit: ((input: PostListItem) => void) | null;
    post: PostListItem;
    setDeleteList: React.Dispatch<React.SetStateAction<PostListItem[]>>;
    agent: Client;
    did: string;
};

function DropdownMenu({ post, handleEdit, agent, did, setDeleteList }: DropsownMenuProps) {
    const { localeData: locale } = useLocale();
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
                    icon: <Check />
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
                icon: <X />,
                loading: false,
                autoClose: true
            });
            close();
            setIsDeleting(false)
            return
        }

        // Clean up DO if post was restricted
        if ([VISIBILITY_FOLLOWERS, VISIBILITY_FOLLOWING, VISIBILITY_MUTUAL].includes(post.blur.visibility || '')) {
            try {
                await agent.post('uk.skyblur.post.deleteStored', {
                    input: {
                        uri: post.blurATUri as ResourceUri
                    }
                });
                console.log('Deleted from DO due to post deletion');
            } catch (e) {
                console.error('Failed to delete from DO:', e);
                // Don't fail the whole operation if DO cleanup fails
            }
        }

        notifications.update({
            id: 'Delete-process',
            title: 'Success',
            message: locale.DeleteList_Complete,
            color: 'teal',
            icon: <Check />,
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
                <Ellipsis size={24} />
            </Menu.Target>

            <Menu.Dropdown>
                <Menu.Label>Menu</Menu.Label>
                {((post.blur.visibility === VISIBILITY_PASSWORD && post.isDecrypt) ||
                    [VISIBILITY_PUBLIC, VISIBILITY_LOGIN, VISIBILITY_FOLLOWERS, VISIBILITY_FOLLOWING, VISIBILITY_MUTUAL].includes(post.blur.visibility || '') ||
                    !post.blur.visibility) &&
                    <Menu.Item leftSection={<SquarePen size={18} />} onClick={() => handleEdit && handleEdit(post)}>{locale.DeleteList_Edit}</Menu.Item>
                }
                <Menu.Item
                    leftSection={<ClipboardCopy size={18} />}
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
                        <BlueskyIcon size={18} />

                    }
                >
                    {locale.DeleteList_ViewBskyPost}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color='red' onClick={open} leftSection={<Trash2 size={18} />}>{locale.DeleteList_DeleteButton}</Menu.Item>
            </Menu.Dropdown>

        </Menu>
    );
}

export default DropdownMenu;
