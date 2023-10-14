import CameraUploader from 'components/CameraUploader'
import GoogleDriveUploader from 'components/GoogleDriveUploader'
import {
    BoxIcon,
    CameraIcon,
    DropBoxIcon,
    GoogleDriveIcon,
    LinkIcon,
    MyDeviceIcon,
    OneDriveIcon,
    UnsplashIcon,
} from 'components/Icons'
import OneDriveUploader from 'components/OneDriveUploader'
import UpupMini from 'components/UpupMini'
import DropZone from 'components/UpupUploader/DropZone'
import MethodsSelector from 'components/UpupUploader/MethodSelector'
import Preview from 'components/UpupUploader/Preview'
import View from 'components/UpupUploader/View'
import UrlUploader from 'components/UrlUploader'
import { AnimatePresence } from 'framer-motion'
import useAddMore from 'hooks/useAddMore'
import useDragAndDrop from 'hooks/useDragAndDrop'
import checkFileType from 'lib/checkFileType'
import { compressFile } from 'lib/compressFile'
import {
    FC,
    ForwardedRef,
    forwardRef,
    LegacyRef,
    RefAttributes,
    useEffect,
    useImperativeHandle,
    useState,
} from 'react'
import { BaseConfigs } from 'types/BaseConfigs'
import { CloudStorageConfigs } from 'types/CloudStorageConfigs'
import { GoogleConfigs } from 'types/GoogleConfigs'
import { Method } from 'types/Method'
import { OneDriveConfigs } from 'types/OneDriveConfigs'
import { UPLOAD_ADAPTER, UploadAdapter } from 'types/UploadAdapter'
import { v4 as uuidv4 } from 'uuid'
import uploadObject from './lib/uploadObject'
import getClient from './lib/getClient'
import MetaVersion from './components/MetaVersion'
import { XhrHttpHandler } from '@aws-sdk/xhr-http-handler'

const methods: Method[] = [
    { id: 'INTERNAL', name: 'My Device', icon: <MyDeviceIcon /> },
    { id: 'GOOGLE_DRIVE', name: 'Google Drive', icon: <GoogleDriveIcon /> },
    {
        id: 'ONE_DRIVE',
        name: 'OneDrive',
        icon: <OneDriveIcon />,
        disabled: true,
    },
    { id: 'BOX', name: 'Box', icon: <BoxIcon />, disabled: true },
    { id: 'LINK', name: 'Link', icon: <LinkIcon /> },
    { id: 'CAMERA', name: 'Camera', icon: <CameraIcon /> },
    { id: 'DROPBOX', name: 'Dropbox', icon: <DropBoxIcon />, disabled: true },
    {
        id: 'UNSPLASH',
        name: 'Unsplash',
        icon: <UnsplashIcon />,
        disabled: true,
    },
]

export interface UpupUploaderProps {
    cloudStorageConfigs: CloudStorageConfigs
    baseConfigs: BaseConfigs
    uploadAdapters: UPLOAD_ADAPTER[]
    googleConfigs?: GoogleConfigs | undefined
    maxFilesSize?: number | undefined
    oneDriveConfigs?: OneDriveConfigs | undefined
}

export type UploadFilesRef = {
    uploadFiles: () => Promise<string[] | []>
}

/**
 *
 * @param cloudStorageConfigs cloud provider configurations
 * @param baseConfigs base configurations
 * @param toBeCompressed whether the user want to compress the file before uploading it or not. Default value is false
 * @param uploadAdapters the methods you want to enable for the user to upload the files. Default value is ['INTERNAL']
 * @param googleConfigs google configurations
 * @param oneDriveConfigs one drive configurations
 * @param ref referrer to the component instance to access its method uploadFiles from the parent component
 * @constructor
 */

export const UpupUploader: FC<UpupUploaderProps & RefAttributes<any>> =
    forwardRef((props: UpupUploaderProps, ref: ForwardedRef<any>) => {
        const {
            cloudStorageConfigs,
            baseConfigs,
            uploadAdapters = ['INTERNAL', 'LINK'],
            googleConfigs,
            maxFilesSize,
            oneDriveConfigs,
        } = props
        const { bucket, s3Configs } = cloudStorageConfigs
        const {
            toBeCompressed = false,
            onChange,
            multiple = false,
            accept = '*',
            limit,
            onFileClick,
            mini = false,
            onFilesChange,
        } = baseConfigs

        const [files, setFiles] = useState<File[]>([])
        const [mutatedFiles, setMutatedFiles] = useState<File[]>([])
        const [view, setView] = useState('internal')

        const {
            isDragging,
            setIsDragging,
            handleDragEnter,
            handleDragLeave,
            containerRef,
        } = useDragAndDrop()

        const { isAddingMore, setIsAddingMore, inputRef } = useAddMore(
            files,
            onChange,
        )

        /**
         * Get the client instance
         */
        const handler = new XhrHttpHandler({})

        handler.on(
            XhrHttpHandler.EVENTS.UPLOAD_PROGRESS,
            (xhr: ProgressEvent) => {
                const progress = Math.round((xhr.loaded / xhr.total) * 100)
                console.log(
                    progress === 100
                        ? '%cUPLOAD COMPLETE'
                        : `%cUpload Progress : ${progress}%`,
                    `color: ${progress === 100 ? '#00ff00' : '#ff9600'}`,
                )
            },
        )
        s3Configs.requestHandler = handler
        const client = getClient(s3Configs)

        /**
         * Expose the handleUpload function to the parent component
         */
        useImperativeHandle(ref, () => ({
            async uploadFiles() {
                if (files.length === 0) return null
                const filesList =
                    mutatedFiles && mutatedFiles.length > 0
                        ? mutatedFiles
                        : files
                return new Promise(async (resolve, reject) => {
                    /**
                     * Check if the total size of files is less than the maximum size
                     */
                    const filesSize = maxFilesSize
                        ? files.reduce((acc, file) => acc + file.size, 0)
                        : 0
                    if (maxFilesSize && filesSize > maxFilesSize) {
                        reject(
                            new Error(
                                'The total size of files must be less than ' +
                                    maxFilesSize / 1024 / 1024 +
                                    'MB',
                            ),
                        )
                    }

                    /**
                     * Upload the file to the cloud storage
                     */
                    let filesToUpload: File[]
                    let keys: string[] = []

                    /**
                     * Compress the file before uploading it to the cloud storage
                     */
                    if (toBeCompressed)
                        filesToUpload = await Promise.all(
                            filesList.map(async file => {
                                /**
                                 * Compress the file
                                 */
                                return await compressFile({
                                    element: file,
                                    element_name: file.name,
                                })
                            }),
                        )
                    else filesToUpload = filesList

                    /**
                     * Loop through the files array and upload the files
                     */

                    if (filesToUpload) {
                        try {
                            filesToUpload.map(async file => {
                                const fileExtension = file.name.split('.').pop()
                                /**
                                 * assign a unique name for the file contain timestamp and random string with extension from the original file
                                 */
                                const key = `${Date.now()}__${uuidv4()}.${fileExtension}`

                                /**
                                 * Upload the file to the cloud storage
                                 */
                                await uploadObject({
                                    client,
                                    bucket,
                                    key,
                                    file,
                                })
                                    .then(data => {
                                        console.log(data)
                                        if (data.httpStatusCode === 200) {
                                            keys.push(key)
                                        } else
                                            throw new Error(
                                                'Something went wrong',
                                            )
                                    })
                                    .catch(err => {
                                        throw new Error(err.message)
                                    })
                                    .finally(() => {
                                        if (
                                            keys.length === filesToUpload.length
                                        )
                                            resolve(keys) // return the keys to the parent component
                                    })
                            })
                        } catch (error) {
                            if (error instanceof Error) {
                                // ✅ TypeScript knows err is Error
                                reject(new Error(error.message))
                            } else {
                                reject(new Error('Something went wrong'))
                            }
                        }
                    } else reject(undefined)
                })
            },
        }))

        /**
         * Check if the user selected at least one upload adapter
         */
        if (uploadAdapters.length === 0) {
            throw new Error('Please select at least one upload adapter')
        }

        /**
         *  Define the components to be rendered based on the user selection of
         *  the upload adapters (internal, google drive, one drive)
         */
        const components = {
            [UploadAdapter.GOOGLE_DRIVE]: (
                <GoogleDriveUploader
                    setFiles={setFiles}
                    setView={setView}
                    googleConfigs={googleConfigs as GoogleConfigs}
                    accept={accept}
                />
            ),
            [UploadAdapter.ONE_DRIVE]: (
                <OneDriveUploader
                    oneDriveConfigs={oneDriveConfigs as OneDriveConfigs}
                    baseConfigs={baseConfigs}
                    setFiles={setFiles}
                    setView={setView}
                />
            ),
            [UploadAdapter.LINK]: (
                <UrlUploader setFiles={setFiles} setView={setView} />
            ),
            [UploadAdapter.CAMERA]: (
                <CameraUploader setFiles={setFiles} setView={setView} />
            ),
        }

        useEffect(() => {
            if (!limit) return

            const difference = files.length - limit

            if (difference <= 0) return

            const newFiles = files.slice(difference)
            setFiles([...newFiles])
        }, [limit, files])

        useEffect(() => {
            if (!onFilesChange || files.length === 0) return setMutatedFiles([])
            const mutateFiles = async () =>
                setMutatedFiles(await onFilesChange([...files]))

            mutateFiles()
        }, [files])

        return mini ? (
            <UpupMini files={files} setFiles={setFiles} />
        ) : (
            <div
                className="w-full max-w-[min(98svh,46rem)] bg-[#f4f4f4] h-[min(98svh,35rem)] rounded-md border flex flex-col relative overflow-hidden select-none dark:bg-[#1f1f1f]"
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                ref={containerRef as LegacyRef<HTMLDivElement>}
            >
                <AnimatePresence>
                    {isDragging && (
                        <DropZone
                            setFiles={setFiles}
                            setIsDragging={setIsDragging}
                            multiple={multiple}
                            accept={accept}
                        />
                    )}
                </AnimatePresence>
                <input
                    type="file"
                    accept={accept}
                    className="absolute w-0 h-0"
                    ref={inputRef}
                    multiple={multiple}
                    onChange={e => {
                        const acceptedFiles = Array.from(
                            e.target.files as FileList,
                        ).filter(file => checkFileType(file, accept))

                        setFiles(files =>
                            isAddingMore
                                ? [...files, ...acceptedFiles]
                                : [...acceptedFiles],
                        )

                        // clear the input value
                        e.target.value = ''
                    }}
                />

                <View
                    view={view}
                    setView={setView}
                    methods={methods}
                    components={components}
                />

                <Preview
                    files={
                        mutatedFiles && mutatedFiles.length > 0
                            ? mutatedFiles
                            : files
                    }
                    setFiles={setFiles}
                    isAddingMore={isAddingMore}
                    setIsAddingMore={setIsAddingMore}
                    multiple={multiple}
                    onFileClick={onFileClick}
                    // handleUpload={handleUpload}
                />
                <div className="p-2 h-full">
                    <div className="border-[#dfdfdf] border-dashed h-full w-full grid grid-rows-[1fr,auto] place-items-center border rounded-md transition-all">
                        <MethodsSelector
                            setView={setView}
                            inputRef={inputRef}
                            methods={methods.filter(method => {
                                return uploadAdapters.includes(method.id as any)
                            })}
                        />
                        <MetaVersion />
                    </div>
                </div>
            </div>
        )
    })
