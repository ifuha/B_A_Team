"use client";
import { useEffect, useState } from "react";

export default function Login() {
  return(
    <div>
      <header
      className="flex fixed top-0 w-full justify-center text-white p-5 bg-primary text-3xl">
        SANSUN学園 成績管理
        </header>
        <div className="flex items-center justify-center flex-col gap-6 h-screen">
          <div className="text-[48px] font-bold">ログイン</div>
          <div className="flex gap-5 items-center">
            <div className="text-2xl">ログインID</div>
            <input className="bg-[#d0d0d0] border h-10 w-125"></input>
          </div>
          <div className="flex gap-5 items-center">
            <div className="text-2xl">パスワード</div>
            <input className="bg-[#d0d0d0] border h-10 w-125"></input>
          </div>
          <div className="btn bg-button font-normal w-39 h-18 text-2xl text-white rounded-[10px]">ログイン</div>
          <div className="text-blue-400 text-xl underline cursor-pointer">パスワードをお忘れの場合</div>
        </div>
    </div>
  )
}18
