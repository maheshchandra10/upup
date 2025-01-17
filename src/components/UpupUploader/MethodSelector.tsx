import { FC, MutableRefObject } from 'react'
import type { Method } from 'types'

type Props = {
    setView: (view: string) => void
    inputRef?: MutableRefObject<HTMLInputElement | null>
    methods: Method[]
}

const MethodsSelector: FC<Props> = ({ setView, inputRef, methods }: Props) => {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-6">
            <h1 className="md:text-2xl text-center dark:text-white">
                Drop your files here,{' '}
                <button
                    className="text-[#3782da] hover:underline"
                    onClick={() => inputRef && inputRef.current!.click()}
                    type="button"
                >
                    browse files
                </button>{' '}
                or import from:
            </h1>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 grid-rows-2">
                {methods.map(method => (
                    <button
                        type="button"
                        key={method.id}
                        className="flex flex-col items-center justify-center gap-1 text-sm dark:hover:bg-[#282828] hover:bg-[#e9ecef] dark:active:bg-[#333] active:bg-[#dfe6f1] rounded-md p-2 px-4 transition-all duration-300 mb-4 disabled:opacity-30 disabled:pointer-events-none group relative"
                        disabled={method.disabled}
                        onKeyDown={e => {
                            if (e.key === 'Enter') e.preventDefault()
                        }}
                        onClick={() =>
                            method.id === 'INTERNAL'
                                ? inputRef && inputRef.current!.click()
                                : setView(method.id)
                        }
                    >
                        <span className="bg-white dark:bg-[#323232] p-[6px] rounded-lg text-2xl shadow">
                            {method.icon}
                        </span>
                        <span className="text-[#525252] dark:text-[#777]">
                            {method.name}
                        </span>
                        <span className="group-disabled:block hidden absolute -bottom-2 opacity-50">
                            (soon)
                        </span>
                    </button>
                ))}
            </div>
        </div>
    )
}

export default MethodsSelector
