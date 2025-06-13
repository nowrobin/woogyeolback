import * as celebrationMsgRepository from "../repositories/celebrationMsgRepository";
import { celebrationMsgData } from "../interfaces/celebrationMsg.interface";
import { ClientError } from "../utils/error";
import { deleteImageFromS3, extractS3KeyFromUrl } from "../utils/s3";

// 1. 전체 축하메세지 정보 조회 + get
export const getAllCelebrationMsgs = async (
  userId: number,
  page: number,
  size: number
) => {
  try {
    // 시작 위치 계산
    const offset = (page - 1) * size;
    const limit = size;

    // repo 호출
    const allCelebrationMsgs =
      await celebrationMsgRepository.findAllcelebrationMsgs(
        userId,
        offset,
        limit
      );

    // 전체 데이터 개수 및 총 페이지 계산
    const totalItems = await celebrationMsgRepository.countCelebrationMsgs(
      userId
    );
    const totalPages = Math.ceil(totalItems / size);

    return {
      allCelebrationMsgs,
      totalItems,
      totalPages,
    };

    // return await celebrationMsgRepository.findAllcelebrationMsgs(userId);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다.";
    throw new Error(
      `모든 축하메세지 정보 기록을 불러오는 것에 실패했습니다. : ${errorMessage}`
    );
  }
};

export const getAllCelebrationMsgsForGuest = async (
  userId: number,
  page: number,
  size: number
) => {
  try {
    // 시작 위치 계산
    const offset = (page - 1) * size;
    const limit = size;

    // repo 호출
    const allCelebrationMsgs =
      await celebrationMsgRepository.findAllcelebrationMsgsForGuest(
        userId,
        offset,
        limit
      );

    // 전체 데이터 개수 및 총 페이지 계산
    const totalItems = await celebrationMsgRepository.countCelebrationMsgsForGuest(
      userId
    );
    const totalPages = Math.ceil(totalItems / size);

    return {
      allCelebrationMsgs,
      totalItems,
      totalPages,
    };

  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다.";
    throw new Error(
      `모든 축하메세지 정보 기록을 불러오는 것에 실패했습니다. : ${errorMessage}`
    );
  }
};

// 2. 개인이 작성한 축하메세지 조회 + get
export const getMyCelebrationMsg = async (
  id: number,
  name: string,
  password: string
) => {
  try {
    return await celebrationMsgRepository.findMyCelebrationMsgByPassword(
      id,
      name,
      password
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다.";
    throw new Error(
      `아이디 ${id}, 이름 ${name}, 비밀번호 ${password}의 축하메세지 정보를 불러오는 것에 실패했습니다. : ${errorMessage}`
    );
  }
};

// 3. 개인이 작성한 축하메세지 등록 + post
export const postMyCelebrationMsg = async (
  celebrationMsgData: celebrationMsgData
) => {
  try {
    if (celebrationMsgData.imageUrl.length > 10) {
      throw new ClientError("이미지 개수는 최대 10개까지 가능합니다.");
    }
    return await celebrationMsgRepository.createMyCelebrationMsg(
      celebrationMsgData
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다.";

    if (error instanceof ClientError) {
      throw error;
    }
    throw new Error(`축하메세지 정보 등록에 실패했습니다. : ${errorMessage}`);
  }
};

// 4. 개인이 작성한 축하메세지 수정 + put
export const putMyCelebrationMsg = async (
  id: number,
  name: string,
  password: string,
  newMessage: string,
  newImageUrl: string[]
) => {
  try {
    const celebrationMsg = await celebrationMsgRepository.findMyCelebrationMsgByPassword(id, name, password);

    if(!celebrationMsg) {
      throw new Error("해당 축하메세지가 존재하지 않습니다.");
    }

    const prevImages: string[] = Array.isArray(celebrationMsg.imageUrl)
      ? celebrationMsg.imageUrl
      : JSON.parse(celebrationMsg.imageUrl || "[]");

    const deletedImages = prevImages.filter(
      (url: string) => !newImageUrl.includes(url)
    );

    for (const url of deletedImages) {
      const key = extractS3KeyFromUrl(url);
      if (key) {
        try {
          await deleteImageFromS3(key);
          console.log(`삭제 성공: ${key}`);
        } catch (err: any) {
          console.error(`S3 삭제 실패 (${key}):`, err.message);
        }
      }
    }

    return await celebrationMsgRepository.updateCelebrationMsgByPassword(
      id,
      name,
      password,
      newMessage,
      newImageUrl
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다.";
    throw new Error(`축하메세지 정보 수정에 실패했습니다. : ${errorMessage}`);
  }
};

// 5. 개인이 작성한 축하메세지 삭제 + delete
export const deleteMyCelebrationMsg = async (
  id: number,
  name: string,
  password: string
) => {
  try {
    return await celebrationMsgRepository.removeMyCelebrationMsgByPassword(
      id,
      name,
      password
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다.";
    throw new Error(
      `다음 이름과 비밀번호로 기록된 축하메세지 정보 삭제에 실패했습니다. name : ${name}, password : ${password} : ${errorMessage}`
    );
  }
};

// 6. 관리자 모드 포토톡 삭제 기능 + delete    // 토큰에서 userId 받아와서 일치하는 경우 -> 어드민 api 수행 -> 바로 삭제 가능하게
export const removeCelebrationMsgByAdmin = async (
  id: number
): Promise<boolean> => {
  try {
    console.log(
      `관리자의 권한으로 축하메세지 정보 삭제 시도중입니다.. id : ${id}`
    );

    const celebrationMsg =
      await celebrationMsgRepository.removeCelebrationMsgByAdmin(id);

    if (!celebrationMsg) {
      console.log(`삭제할 축하메세지 정보가 없습니다. id : ${id}`);
      return false;
    }

    console.log(`축하메세지 삭제에 성공했습니다. id : ${id}`);

    return true;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다.";

    throw new Error(
      `관리자로 축하메세지 삭제에 실패했습니다. (id: ${id}) : ${errorMessage}`
    );
  }
};
